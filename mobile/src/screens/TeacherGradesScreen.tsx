import { localizeCopy, uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import dayjs from 'dayjs'
import { ChevronLeft, Plus, BookMarked, ListChecks, Lock } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { ScreenHeading } from '../components/ui'
import BottomModal from '../components/BottomModal'
import Dropdown from '../components/Dropdown'
import ClassPicker from '../components/ClassPicker'
import EmptyState from '../components/EmptyState'
import { Field, Select } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { gradeTone } from '../lib/gradeStyle'
import { notifyError } from '../lib/notify'
import { useMyClasses } from '../lib/useMyClasses'
import { studentsApi, type StudentDto } from '../api/students'
import {
  schoolApi,
  type GradeDto,
  type GradeType,
  type SubjectDto,
  type TermDto,
} from '../api/school'

const TYPE_LABELS: Record<GradeType, string> = localizeCopy({
  CLASSWORK: 'Урок',
  HOMEWORK: 'ДЗ',
  CONTROL: 'Контр.',
  EXAM: 'Экзамен',
  PROJECT: 'Проект',
  OTHER: 'Другое',
})

/**
 * Журнал оценок. Начинается с выбора класса и предмета: пока они не выбраны, учеников нет —
 * так оценка не попадёт не тому классу. Показываются только классы и предметы, к которым
 * администратор открыл учителю доступ.
 */
export default function TeacherGradesScreen() {
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [uiLanguage()])
  const { classes, loading: classesLoading, reload: reloadClasses } = useMyClasses()

  // Выбранные класс и предмет. Пока оба не выбраны, список учеников пуст.
  const [groupId, setGroupId] = useState<string | null>(null)
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)

  // Выбранный ученик: оценка с клавиатуры внизу ставится ему и выбор переходит к следующему.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [students, setStudents] = useState<StudentDto[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [grades, setGrades] = useState<GradeDto[]>([])
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [terms, setTerms] = useState<TermDto[]>([])
  const [activeTermId, setActiveTermId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Быстрый ввод
  const [editingStudent, setEditingStudent] = useState<StudentDto | null>(null)
  const [date, setDate] = useState(today)
  const [type, setType] = useState<GradeType>('CLASSWORK')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const group = classes.find((c) => c.id === groupId) ?? null
  const subject = subjects.find((s) => s.id === activeSubjectId) ?? null
  const ready = !!group && !!subject

  // Предметы учителя и четверти. Сервер отдаёт учителю только открытые ему предметы.
  const reload = useCallback(async () => {
    try {
      const [subs, ts] = await Promise.all([
        schoolApi.listSubjects(),
        schoolApi.listTerms().catch(() => [] as TermDto[]),
      ])
      setSubjects(subs)
      setTerms(ts)
      // Выбранный предмет, которого больше нет в списке, сбрасываем
      setActiveSubjectId((cur) => (cur && subs.some((s) => s.id === cur) ? cur : subs.length === 1 ? subs[0].id : null))
      // авто-выбор текущей четверти
      if (ts.length) {
        const cur = await schoolApi.currentTerm().catch(() => null)
        if (cur) setActiveTermId((t) => t ?? cur.id)
      }
    } catch (e) {
      notifyError(e, { fallback: uiText("Не удалось загрузить предметы"), retry: () => void reload() })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Единственный класс выбираем сам: перепутать нечего
  useEffect(() => {
    if (classes.length === 1) setGroupId((cur) => cur ?? classes[0].id)
    else if (groupId && !classes.some((c) => c.id === groupId)) setGroupId(null)
  }, [classes, groupId])

  // Ученики выбранного класса
  const loadStudents = useCallback(async () => {
    if (!groupId) {
      setStudents([])
      return
    }
    try {
      setStudentsLoading(true)
      setStudents(await studentsApi.list({ status: 'ACTIVE', groupId }))
    } catch (e) {
      notifyError(e, { fallback: uiText("Не удалось загрузить учеников"), retry: () => void loadStudents() })
    } finally {
      setStudentsLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    setSelectedId(null)
    setEditingStudent(null)
    void loadStudents()
  }, [loadStudents])

  useEffect(() => {
    setSelectedId(null)
  }, [activeSubjectId])

  // Диапазон дат: четверть или месяц
  const range = useMemo(() => {
    const term = terms.find((t) => t.id === activeTermId)
    if (term) {
      return {
        from: dayjs(term.startDate).format('YYYY-MM-DD'),
        to: dayjs(term.endDate).format('YYYY-MM-DD'),
      }
    }
    return {
      from: dayjs(month + '-01').format('YYYY-MM-DD'),
      to: dayjs(month + '-01').endOf('month').format('YYYY-MM-DD'),
    }
  }, [terms, activeTermId, month, uiLanguage()])

  const reloadGrades = useCallback(async () => {
    if (!activeSubjectId || !groupId) {
      setGrades([])
      return
    }
    try {
      const g = await schoolApi.listGrades({
        subjectId: activeSubjectId,
        from: range.from,
        to: range.to,
      })
      setGrades(g)
    } catch (e) {
      notifyError(e, { retry: () => void reloadGrades() })
    }
  }, [activeSubjectId, groupId, range.from, range.to])

  useEffect(() => {
    void reloadGrades()
  }, [reloadGrades])

  const gradesByStudent = useMemo(() => {
    const map: Record<string, GradeDto[]> = {}
    for (const g of grades) {
      if (!map[g.studentId]) map[g.studentId] = []
      map[g.studentId].push(g)
    }
    return map
  }, [grades, uiLanguage()])

  const avgByStudent = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [sid, list] of Object.entries(gradesByStudent)) {
      const sum = list.reduce((s, g) => s + g.value, 0)
      map[sid] = list.length ? Number((sum / list.length).toFixed(1)) : 0
    }
    return map
  }, [gradesByStudent, uiLanguage()])

  /** Мгновенно ставит оценку value текущему editingStudent. */
  const quickSave = async (value: number) => {
    if (!editingStudent || !activeSubjectId || !ready) return
    setSaving(true)
    try {
      await schoolApi.createGrade({
        studentId: editingStudent.id,
        subjectId: activeSubjectId,
        value,
        type,
        date,
        comment: comment.trim() || undefined,
      })
      setEditingStudent(null)
      setComment('')
      setType('CLASSWORK')
      void reloadGrades()
    } catch (e) {
      notifyError(e)
    } finally {
      setSaving(false)
    }
  }

  /** Оценка с клавиатуры: сегодняшняя оценка за урок выбранному ученику, затем — следующий по списку. */
  const padSave = async (value: number) => {
    if (!selectedId || !activeSubjectId || !ready) return
    setSaving(true)
    try {
      await schoolApi.createGrade({
        studentId: selectedId,
        subjectId: activeSubjectId,
        value,
        type: 'CLASSWORK',
        date: today,
      })
      await reloadGrades()
      const i = students.findIndex((s) => s.id === selectedId)
      setSelectedId(students[Math.min(i + 1, students.length - 1)]?.id ?? selectedId)
    } catch (e) {
      notifyError(e)
    } finally {
      setSaving(false)
    }
  }

  const removeGrade = (g: GradeDto) => {
    Alert.alert(
      uiText("Оценка") + g.value,
      `${TYPE_LABELS[g.type]} · ${dayjs(g.date).format('D MMM')}${g.comment ? '\n«' + g.comment + '»' : ''}`,
      [
        { text: uiText("Отмена"), style: 'cancel' },
        {
          text: uiText("Удалить"),
          style: 'destructive',
          onPress: async () => {
            try {
              await schoolApi.deleteGrade(g.id)
              void reloadGrades()
            } catch (e) {
              notifyError(e)
            }
          },
        },
      ],
    )
  }

  if (loading || classesLoading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const noAccess = classes.length === 0
  const noSubjects = subjects.length === 0

  return (
    <Screen>
      <View style={styles.topBar}>
        <ScreenHeading
          eyebrow={ready ? `${group?.name} · ${subject?.name}` : dayjs().format('D MMMM')}
          title={uiText("Журнал оценок")}
        />
      </View>

      <FlatList
        data={ready ? students : []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void Promise.all([reload(), reloadClasses(), loadStudents(), reloadGrades()])
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 12, gap: 14 }}>
            {!noAccess && (
              <View>
                <Text style={styles.section}>{uiText("Класс")}</Text>
                <ClassPicker classes={classes} value={groupId} onChange={setGroupId} />
              </View>
            )}

            {!noSubjects && (
              <View>
                <Text style={styles.section}>{uiText("Предмет")}</Text>
                <View style={styles.chipRow}>
                  {subjects.map((s) => {
                    const on = s.id === activeSubjectId
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setActiveSubjectId(on ? null : s.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={[styles.subjectChip, on && styles.subjectChipOn]}
                      >
                        <View style={[styles.dot, { backgroundColor: s.color }]} />
                        <Text style={[styles.subjectText, on && styles.subjectTextOn]}>{s.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            {ready && terms.length > 0 && (
              <View>
                <Text style={styles.section}>{uiText("Четверть")}</Text>
                <Dropdown
                  value={activeTermId ?? '__month__'}
                  onChange={(v) => setActiveTermId(v === '__month__' ? null : v)}
                  options={[
                    { value: '__month__', label: uiText("По месяцу") },
                    ...terms.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                />
              </View>
            )}

            {ready && !activeTermId && (
              <View>
                <Text style={styles.section}>{uiText("Месяц")}</Text>
                <View style={styles.dayBar}>
                  <Pressable
                    onPress={() => setMonth(dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM'))}
                    hitSlop={10}
                    style={styles.dayBtn}
                  >
                    <ChevronLeft size={20} color={colors.text} />
                  </Pressable>
                  <Text style={styles.dayLabel}>{dayjs(month + '-01').format('MMMM YYYY')}</Text>
                  <Pressable
                    onPress={() => setMonth(dayjs(month + '-01').add(1, 'month').format('YYYY-MM'))}
                    hitSlop={10}
                    style={styles.dayBtn}
                  >
                    <ChevronLeft size={20} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const fullName = `${item.firstName} ${item.lastName}`.trim()
          const stuGrades = gradesByStudent[item.id] ?? []
          const avg = avgByStudent[item.id] ?? 0
          const selected = selectedId === item.id
          const initials = `${item.firstName[0] ?? ''}${item.lastName[0] ?? ''}`.toUpperCase()
          return (
            <Pressable
              onPress={() => setSelectedId(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={uiText("Выбрать: {0}", fullName)}
            >
              <Card padding={12} style={selected ? styles.cardOn : undefined}>
                <View style={styles.row}>
                  <View style={styles.initial}>
                    <Text style={styles.initialText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{fullName}</Text>
                    <View style={styles.gradeStrip}>
                      {stuGrades.map((g) => (
                        <Pressable key={g.id} onPress={() => removeGrade(g)}>
                          <View style={[styles.gradeBubble, { backgroundColor: gradeColor(g.value) }]}>
                            <Text style={styles.gradeBubbleText}>{g.value}</Text>
                          </View>
                        </Pressable>
                      ))}
                      {stuGrades.length === 0 && <Text style={styles.noGrade}>{uiText("нет оценок")}</Text>}
                    </View>
                  </View>

                  {avg > 0 && (
                    <View style={styles.avgBox}>
                      <Text style={styles.avgLabel}>{uiText("ср.")}</Text>
                      <Text style={[styles.avgValue, { color: gradeColor(Math.round(avg)) }]}>{avg.toFixed(1)}</Text>
                    </View>
                  )}

                  <Pressable
                    onPress={() => {
                      setEditingStudent(item)
                      setDate(today)
                      setType('CLASSWORK')
                      setComment('')
                    }}
                    style={styles.addBtn}
                  >
                    <Plus size={18} color={colors.primaryDeep} />
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          noAccess ? (
            <EmptyState
              icon={<Lock size={34} color={colors.muted} />}
              title={uiText("Нет доступа к классам")}
              hint={uiText("Администратор ещё не открыл вам классы. Попросите его в разделе «Доступ учителей».")}
            />
          ) : noSubjects ? (
            <EmptyState
              icon={<BookMarked size={34} color={colors.muted} />}
              title={uiText("Нет доступа к предметам")}
              hint={uiText("Администратор ещё не открыл вам предметы. Попросите его в разделе «Доступ учителей».")}
            />
          ) : !ready ? (
            <EmptyState
              icon={<ListChecks size={34} color={colors.muted} />}
              title={!group ? uiText("Выберите класс") : uiText("Выберите предмет")}
              hint={uiText("Пока класс и предмет не выбраны, список учеников скрыт — так оценка не попадёт не тому классу.")}
            />
          ) : studentsLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <EmptyState title={uiText("В этом классе пока никого нет")} />
          )
        }
      />

      {/* Клавиатура оценок: выбрали ученика — нажали оценку — она сохранилась, выбран следующий */}
      {ready && selectedId && (
        <View style={styles.keypad}>
          <Text style={styles.keypadFor} numberOfLines={1}>
            {" " + uiText("Оценка для:")}{' '}
            <Text style={styles.keypadName}>
              {(() => {
                const s = students.find((x) => x.id === selectedId)
                return s ? `${s.firstName} ${s.lastName}` : ''
              })()}
            </Text>
            {` · ${group?.name} · ${subject?.name}`}
          </Text>
          <View style={styles.keys}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
              const tone = gradeTone(v)
              return (
                <Pressable
                  key={v}
                  disabled={saving}
                  onPress={() => padSave(v)}
                  accessibilityRole="button"
                  accessibilityLabel={uiText("Оценка {0}", v)}
                  style={({ pressed }) => [
                    styles.key,
                    { backgroundColor: tone.bg, opacity: saving ? 0.5 : 1 },
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <Text style={[styles.keyText, { color: tone.fg }]}>{v}</Text>
                </Pressable>
              )
            })}
          </View>
          <Pressable
            onPress={() => {
              const s = students.find((x) => x.id === selectedId)
              if (!s) return
              setEditingStudent(s)
              setDate(today)
              setType('CLASSWORK')
              setComment('')
            }}
            accessibilityRole="button"
          >
            <Text style={styles.more}>{uiText("Другая дата, тип или комментарий")}</Text>
          </Pressable>
        </View>
      )}

      <BottomModal
        visible={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={
          editingStudent
            ? uiText("Оценка · {0} {1}", editingStudent.firstName, editingStudent.lastName)
            : uiText("Оценка")
        }
      >
        {/* Дата */}
        <View style={styles.modalDayBar}>
          <Pressable
            onPress={() => setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}
            hitSlop={8}
            style={styles.dayBtn}
          >
            <ChevronLeft size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.modalDayLabel}>
            {dayjs(date).format('dd, D MMMM')}
            {date === today ? uiText("· сегодня") : ''}
          </Text>
          <Pressable
            onPress={() => setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}
            hitSlop={8}
            style={styles.dayBtn}
          >
            <ChevronLeft size={18} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        </View>

        <Select<GradeType>
          label={uiText("Тип")}
          value={type}
          onChange={setType}
          options={[
            { value: 'CLASSWORK', label: uiText("Урок") },
            { value: 'HOMEWORK', label: uiText("ДЗ") },
            { value: 'CONTROL', label: uiText("Контр.") },
            { value: 'EXAM', label: uiText("Экзамен") },
            { value: 'PROJECT', label: uiText("Проект") },
            { value: 'OTHER', label: uiText("Другое") },
          ]}
          columns={3}
        />

        <Field
          label={uiText("Комментарий (необязательно)")}
          value={comment}
          onChangeText={setComment}
          placeholder={uiText("За что")}
        />

        {/* Большие кнопки оценок — мгновенное сохранение */}
        <Text style={styles.gradePadLabel}>{uiText("Нажмите оценку — она сразу сохранится")}</Text>
        <View style={styles.gradePad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
            <Pressable
              key={v}
              disabled={saving}
              onPress={() => quickSave(v)}
              style={({ pressed }) => [
                styles.gradeKey,
                {
                  backgroundColor: gradeColor(v),
                  opacity: saving ? 0.5 : pressed ? 0.8 : 1,
                },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Text style={styles.gradeKeyText}>{v}</Text>
            </Pressable>
          ))}
        </View>

        {saving && (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </BottomModal>
    </Screen>
  )
}

function gradeColor(v: number): string {
  if (v >= 9) return colors.primaryDeep
  if (v >= 7) return colors.primary
  if (v >= 4) return colors.yellowDeep
  return colors.roseDeep
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  list: { padding: 16, paddingBottom: 40 },
  section: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  subjectChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5 },
  subjectText: { fontSize: 14, fontWeight: '700', color: colors.text },
  subjectTextOn: { color: colors.onPrimary },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...shadow.sm,
  },
  dayBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  dayLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  gradeStrip: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  gradeBubble: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBubbleText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  noGrade: { fontSize: 12, color: colors.muted },
  avgBox: { alignItems: 'center', marginRight: 8, minWidth: 36 },
  avgLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  avgValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  // modal
  modalDayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modalDayLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  gradePadLabel: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  gradePad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  gradeKey: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeKeyText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  cardOn: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surfaceStrong },
  initial: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 13, fontWeight: '700', color: colors.text },
  // клавиатура оценок
  keypad: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 24,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
    ...shadow.md,
  },
  keypadFor: { fontSize: 13, fontWeight: '600', color: colors.textMid },
  keypadName: { color: colors.text, fontWeight: '800' },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    width: '18%',
    flexGrow: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 22, fontWeight: '800' },
  more: { fontSize: 13, fontWeight: '700', color: colors.primaryDeep, textAlign: 'center', paddingVertical: 2 },
}))
