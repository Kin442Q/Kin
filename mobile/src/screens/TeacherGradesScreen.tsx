import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { ChevronLeft, Plus, BookMarked } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import BottomModal from '../components/BottomModal'
import Dropdown from '../components/Dropdown'
import { Field, Select } from '../components/Field'
import { colors, radius, shadow } from '../theme/colors'
import { studentsApi, type StudentDto } from '../api/students'
import {
  schoolApi,
  type GradeDto,
  type GradeType,
  type SubjectDto,
  type TermDto,
} from '../api/school'

const TYPE_LABELS: Record<GradeType, string> = {
  CLASSWORK: 'Урок',
  HOMEWORK: 'ДЗ',
  CONTROL: 'Контр.',
  EXAM: 'Экзамен',
  PROJECT: 'Проект',
  OTHER: 'Другое',
}

export default function TeacherGradesScreen() {
  const navigation = useNavigation()
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

  const [students, setStudents] = useState<StudentDto[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
  const [grades, setGrades] = useState<GradeDto[]>([])
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [terms, setTerms] = useState<TermDto[]>([])
  const [activeTermId, setActiveTermId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Быстрый ввод
  const [editingStudent, setEditingStudent] = useState<StudentDto | null>(null)
  const [date, setDate] = useState(today)
  const [type, setType] = useState<GradeType>('CLASSWORK')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [list, subs, ts] = await Promise.all([
        studentsApi.list({ status: 'ACTIVE' }),
        schoolApi.listSubjects(),
        schoolApi.listTerms().catch(() => [] as TermDto[]),
      ])
      setStudents(list)
      setSubjects(subs)
      setTerms(ts)
      if (subs.length && !activeSubjectId) setActiveSubjectId(subs[0].id)
      // авто-выбор текущей четверти
      if (ts.length && !activeTermId) {
        const cur = await schoolApi.currentTerm().catch(() => null)
        if (cur) setActiveTermId(cur.id)
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeSubjectId, activeTermId])

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
  }, [terms, activeTermId, month])

  const reloadGrades = useCallback(async () => {
    if (!activeSubjectId) return
    try {
      const g = await schoolApi.listGrades({
        subjectId: activeSubjectId,
        from: range.from,
        to: range.to,
      })
      setGrades(g)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    }
  }, [activeSubjectId, range.from, range.to])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    reloadGrades()
  }, [reloadGrades])

  const gradesByStudent = useMemo(() => {
    const map: Record<string, GradeDto[]> = {}
    for (const g of grades) {
      if (!map[g.studentId]) map[g.studentId] = []
      map[g.studentId].push(g)
    }
    return map
  }, [grades])

  const avgByStudent = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [sid, list] of Object.entries(gradesByStudent)) {
      const sum = list.reduce((s, g) => s + g.value, 0)
      map[sid] = list.length ? Number((sum / list.length).toFixed(1)) : 0
    }
    return map
  }, [gradesByStudent])

  /** Мгновенно ставит оценку value текущему editingStudent. */
  const quickSave = async (value: number) => {
    if (!editingStudent || !activeSubjectId) return
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
      reloadGrades()
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const removeGrade = (g: GradeDto) => {
    Alert.alert(
      'Оценка ' + g.value,
      `${TYPE_LABELS[g.type]} · ${dayjs(g.date).format('D MMM')}${g.comment ? '\n«' + g.comment + '»' : ''}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await schoolApi.deleteGrade(g.id)
              reloadGrades()
            } catch (e: any) {
              Alert.alert('Ошибка', e?.response?.data?.message || String(e))
            }
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Журнал оценок</Text>
        <View style={{ width: 36 }} />
      </View>

      {subjects.length === 0 ? (
        <View style={styles.empty}>
          <BookMarked size={36} color={colors.muted} />
          <Text style={styles.emptyText}>
            Сначала администратор должен добавить предметы в веб-версии.
          </Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                Promise.all([reload(), reloadGrades()])
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.section}>Предмет</Text>
              <Dropdown
                value={activeSubjectId}
                onChange={setActiveSubjectId}
                placeholder="Выберите предмет"
                options={subjects.map((s) => ({
                  value: s.id,
                  label: s.name,
                  color: s.color,
                }))}
              />

              {terms.length > 0 && (
                <>
                  <Text style={[styles.section, { marginTop: 12 }]}>Четверть</Text>
                  <Dropdown
                    value={activeTermId ?? '__month__'}
                    onChange={(v) =>
                      setActiveTermId(v === '__month__' ? null : v)
                    }
                    options={[
                      { value: '__month__', label: 'По месяцу' },
                      ...terms.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                  />
                </>
              )}

              {!activeTermId && (
                <>
                  <Text style={[styles.section, { marginTop: 12 }]}>Месяц</Text>
                  <View style={styles.dayBar}>
                    <Pressable
                      onPress={() =>
                        setMonth(dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM'))
                      }
                      hitSlop={10}
                      style={styles.dayBtn}
                    >
                      <ChevronLeft size={20} color={colors.text} />
                    </Pressable>
                    <Text style={styles.dayLabel}>
                      {dayjs(month + '-01').format('MMMM YYYY')}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setMonth(dayjs(month + '-01').add(1, 'month').format('YYYY-MM'))
                      }
                      hitSlop={10}
                      style={styles.dayBtn}
                    >
                      <ChevronLeft
                        size={20}
                        color={colors.text}
                        style={{ transform: [{ rotate: '180deg' }] }}
                      />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const fullName = `${item.firstName} ${item.lastName}`.trim()
            const stuGrades = gradesByStudent[item.id] ?? []
            const avg = avgByStudent[item.id] ?? 0
            return (
              <Card padding={12}>
                <View style={styles.row}>
                  <Avatar name={fullName} size={38} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{fullName}</Text>
                    <View style={styles.gradeStrip}>
                      {stuGrades.map((g) => (
                        <Pressable key={g.id} onPress={() => removeGrade(g)}>
                          <View
                            style={[styles.gradeBubble, { backgroundColor: gradeColor(g.value) }]}
                          >
                            <Text style={styles.gradeBubbleText}>{g.value}</Text>
                          </View>
                        </Pressable>
                      ))}
                      {stuGrades.length === 0 && <Text style={styles.noGrade}>нет оценок</Text>}
                    </View>
                  </View>

                  {avg > 0 && (
                    <View style={styles.avgBox}>
                      <Text style={styles.avgLabel}>ср.</Text>
                      <Text style={[styles.avgValue, { color: gradeColor(Math.round(avg)) }]}>
                        {avg.toFixed(1)}
                      </Text>
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
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>В вашем классе пока никого нет.</Text>
            </View>
          }
        />
      )}

      <BottomModal
        visible={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={
          editingStudent
            ? `Оценка · ${editingStudent.firstName} ${editingStudent.lastName}`
            : 'Оценка'
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
            {date === today ? ' · сегодня' : ''}
          </Text>
          <Pressable
            onPress={() => setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}
            hitSlop={8}
            style={styles.dayBtn}
          >
            <ChevronLeft
              size={18}
              color={colors.text}
              style={{ transform: [{ rotate: '180deg' }] }}
            />
          </Pressable>
        </View>

        <Select<GradeType>
          label="Тип"
          value={type}
          onChange={setType}
          options={[
            { value: 'CLASSWORK', label: 'Урок' },
            { value: 'HOMEWORK', label: 'ДЗ' },
            { value: 'CONTROL', label: 'Контр.' },
            { value: 'EXAM', label: 'Экзамен' },
            { value: 'PROJECT', label: 'Проект' },
            { value: 'OTHER', label: 'Другое' },
          ]}
          columns={3}
        />

        <Field
          label="Комментарий (необязательно)"
          value={comment}
          onChangeText={setComment}
          placeholder="За что"
        />

        {/* Большие кнопки оценок — мгновенное сохранение */}
        <Text style={styles.gradePadLabel}>Нажмите оценку — она сразу сохранится</Text>
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

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  topTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
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
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
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
})
