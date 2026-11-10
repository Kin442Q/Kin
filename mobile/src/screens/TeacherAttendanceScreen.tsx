import { localizeCopy, uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import dayjs from 'dayjs'
import { useNavigation } from '@react-navigation/native'
import { Check, ChevronLeft, ListChecks, Lock, Plane, Send, Thermometer, X, type LucideIcon } from 'lucide-react-native'

import Screen from '../components/Screen'
import Btn from '../components/Btn'
import BottomModal from '../components/BottomModal'
import ClassPicker from '../components/ClassPicker'
import EmptyState from '../components/EmptyState'
import { Field, Select } from '../components/Field'
import { colors } from '../theme/colors'
import { useLabels } from '../theme/useLabels'
import { diaryApi, type Mood, type NapQuality, type KidNoteDto } from '../api/diary'
import { studentsApi, type StudentDto } from '../api/students'
import {
  attendanceApi,
  type AttendanceDto,
  type AttendanceStatus,
} from '../api/attendance'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
import { useMyClasses } from '../lib/useMyClasses'
interface Row {
  student: StudentDto
  status: AttendanceStatus | null
}

/** Четыре статуса из макета: кнопка-значок; выбранный — залитая плашка своего цвета. */
const STATUSES: Array<{
  key: AttendanceStatus
  label: string
  icon: LucideIcon
  solid: string
  onSolid: string
  idle: string
}> = localizeCopy([
  { key: 'PRESENT', label: 'Здесь', icon: Check, solid: '#0D7A7C', onSolid: '#FFFFFF', idle: '#0D7A7C' },
  { key: 'ABSENT', label: 'Нет', icon: X, solid: '#10282A', onSolid: '#FFFFFF', idle: '#5E7375' },
  { key: 'SICK', label: 'Болеет', icon: Thermometer, solid: '#FF8A65', onSolid: '#10282A', idle: '#D9532E' },
  { key: 'VACATION', label: 'Отпуск', icon: Plane, solid: '#F6C46A', onSolid: '#10282A', idle: '#A8740F' },
])

const AVATAR_GRADIENTS = ['#9EDDD9', '#FFD3C2', '#FBE3A9']

export default function TeacherAttendanceScreen() {
  const L = useLabels()
  const navigation = useNavigation<any>()
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [uiLanguage()])

  const { classes, loading: classesLoading, reload: reloadClasses } = useMyClasses()
  // Класс выбирается первым: пока он не выбран, список пуст и отметить некого
  const [groupId, setGroupId] = useState<string | null>(null)
  const [studentsLoading, setStudentsLoading] = useState(false)

  const [students, setStudents] = useState<StudentDto[]>([])
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [kidNotes, setKidNotes] = useState<Record<string, KidNoteDto>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Modal: заметка о ребёнке
  const [noteFor, setNoteFor] = useState<StudentDto | null>(null)
  const [noteMood, setNoteMood] = useState<Mood | null>(null)
  const [noteNap, setNoteNap] = useState<NapQuality | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!groupId) {
      setStudents([])
      setMarks({})
      setKidNotes({})
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      setStudentsLoading(true)
      const [list, attendance] = await Promise.all([
        studentsApi.list({ status: 'ACTIVE', groupId }),
        attendanceApi.listByDay(today, groupId),
      ])
      setStudents(list)
      const map: Record<string, AttendanceStatus> = {}
      for (const a of attendance) map[a.studentId] = a.status
      setMarks(map)

      // Заметки о детях за день для выбранного класса
      try {
        const notes = await diaryApi.kidNotesForGroup(groupId, today)
        const noteMap: Record<string, KidNoteDto> = {}
        for (const n of notes) noteMap[n.studentId] = n
        setKidNotes(noteMap)
      } catch {
        // некритично
      }
    } catch (e) {
      notifyError(e, { retry: () => void reload() })
    } finally {
      setLoading(false)
      setStudentsLoading(false)
      setRefreshing(false)
    }
  }, [today, groupId])

  // Единственный класс выбираем сам: перепутать нечего
  useEffect(() => {
    if (classes.length === 1) setGroupId((cur) => cur ?? classes[0].id)
    else if (groupId && !classes.some((c) => c.id === groupId)) setGroupId(null)
  }, [classes, groupId])

  const openNoteModal = (student: StudentDto) => {
    const existing = kidNotes[student.id]
    setNoteFor(student)
    setNoteMood(existing?.mood ?? null)
    setNoteNap(existing?.napQuality ?? null)
    setNoteText(existing?.note ?? '')
  }

  const saveNote = async () => {
    if (!noteFor) return
    setNoteSaving(true)
    try {
      const saved = await diaryApi.upsertKidNote({
        studentId: noteFor.id,
        date: today,
        mood: noteMood ?? undefined,
        napQuality: noteNap ?? undefined,
        note: noteText.trim() || undefined,
      })
      setKidNotes((m) => ({ ...m, [noteFor.id]: saved }))
      setNoteFor(null)
    } catch (e: any) {
      notifyError(e)
    } finally {
      setNoteSaving(false)
    }
  }

  useEffect(() => {
    reload()
  }, [reload])

  const setStatus = async (studentId: string, status: AttendanceStatus) => {
    // Optimistic update
    const prev = marks[studentId]
    setMarks((m) => ({ ...m, [studentId]: status }))
    setSavingId(studentId)
    try {
      await attendanceApi.mark({ studentId, date: today, status })
    } catch (e: any) {
      // Откат
      setMarks((m) => {
        const next = { ...m }
        if (prev) next[studentId] = prev
        else delete next[studentId]
        return next
      })
      notifyError(e, { title: uiText("Не сохранилось") })
    } finally {
      setSavingId(null)
    }
  }

  const counts = useMemo(() => {
    const vals = Object.values(marks)
    const of = (s: AttendanceStatus) => vals.filter((v) => v === s).length
    return {
      total: students.length,
      marked: vals.length,
      present: of('PRESENT'),
      absent: of('ABSENT'),
      sick: of('SICK'),
      vacation: of('VACATION'),
    }
  }, [marks, students, uiLanguage()])

  if (loading || classesLoading) {
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
      <FlatList
        data={groupId ? students : []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void Promise.all([reload(), reloadClasses()])
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headRow}>
              <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={uiText("Назад")} style={styles.back}>
                <ChevronLeft size={22} color={colors.text} />
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eyebrow}>{dayjs().format('dddd, D MMMM')}</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {" " + uiText("Посещаемость")}{groupId ? ` ${classes.find((c) => c.id === groupId)?.name ?? ''}` : ''}
                </Text>
              </View>
            </View>
            {classes.length > 1 && <ClassPicker classes={classes} value={groupId} onChange={setGroupId} />}
            {!!groupId && (
              <View style={styles.counters}>
                <View style={[styles.counter, { backgroundColor: '#0D7A7C' }]}>
                  <Text style={[styles.counterText, { color: '#FFFFFF' }]}>{uiText("Здесь") + " "}{counts.present}</Text>
                </View>
                <View style={[styles.counter, { backgroundColor: 'rgba(16,40,42,0.08)' }]}>
                  <Text style={[styles.counterText, { color: colors.text }]}>{uiText("Нет") + " "}{counts.absent}</Text>
                </View>
                <View style={[styles.counter, { backgroundColor: 'rgba(255,138,101,0.25)' }]}>
                  <Text style={[styles.counterText, { color: '#B23E1A' }]}>{uiText("Болеет") + " "}{counts.sick}</Text>
                </View>
                <View style={[styles.counter, { backgroundColor: 'rgba(246,196,106,0.35)' }]}>
                  <Text style={[styles.counterText, { color: '#7A5208' }]}>{uiText("Отпуск") + " "}{counts.vacation}</Text>
                </View>
              </View>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item, index }) => (
          <StudentRow
            index={index}
            student={item}
            status={marks[item.id] ?? null}
            saving={savingId === item.id}
            hasNote={!!kidNotes[item.id]}
            onChange={(s) => setStatus(item.id, s)}
            onOpenNote={() => openNoteModal(item)}
          />
        )}
        ListEmptyComponent={
          classes.length === 0 ? (
            <EmptyState
              icon={<Lock size={34} color={colors.muted} />}
              title={uiText("Нет доступа к классам")}
              hint={uiText("Администратор ещё не открыл вам классы. Попросите его в разделе «Доступ учителей».")}
            />
          ) : !groupId ? (
            <EmptyState
              icon={<ListChecks size={34} color={colors.muted} />}
              title={uiText("Выберите класс")}
              hint={uiText("Пока класс не выбран, список скрыт — так отметка не попадёт не тому классу.")}
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

      {!!groupId && students.length > 0 && (
        <View style={styles.saveBar}>
          <Pressable
            onPress={() => navigation.navigate('TeacherHome')}
            disabled={savingId !== null}
            accessibilityRole="button"
            style={({ pressed }) => [styles.save, (pressed || savingId !== null) && { opacity: 0.85 }]}
          >
            <Send size={20} color="#FFFFFF" />
            <Text style={styles.saveText}>{uiText("Сохранить · родители увидят сразу")}</Text>
          </Pressable>
        </View>
      )}

      <BottomModal
        visible={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={
          noteFor
            ? uiText("Заметка о {0} {1}", noteFor.firstName, noteFor.lastName)
            : uiText("Заметка")
        }
      >
        <Select<Mood>
          label={uiText("Настроение")}
          value={noteMood}
          onChange={setNoteMood}
          options={[
            { value: 'HAPPY', label: uiText("😊 Хорошее") },
            { value: 'NEUTRAL', label: uiText("😐 Обычное") },
            { value: 'SAD', label: uiText("😟 Грустное") },
            { value: 'SICK', label: uiText("🤒 Болел") },
          ]}
          columns={2}
        />

        {!L.isSchool && (
          <Select<NapQuality>
            label={uiText("Сон")}
            value={noteNap}
            onChange={setNoteNap}
            options={[
              { value: 'GOOD', label: uiText("Хорошо") },
              { value: 'NORMAL', label: uiText("Обычно") },
              { value: 'POOR', label: uiText("Плохо") },
              { value: 'NO_NAP', label: uiText("Не спал") },
            ]}
            columns={2}
          />
        )}

        <Field
          label={uiText("Заметка")}
          value={noteText}
          onChangeText={setNoteText}
          placeholder={uiText("Что хочется передать родителям")}
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Btn block size="lg" loading={noteSaving} onPress={saveNote}>
          {" " + uiText("Сохранить заметку") + " "}</Btn>
      </BottomModal>
    </Screen>
  )
}

interface RowProps {
  index: number
  student: StudentDto
  status: AttendanceStatus | null
  saving: boolean
  hasNote: boolean
  onChange: (s: AttendanceStatus) => void
  onOpenNote: () => void
}

/** Строка ученика из макета: круглая «аватарка», имя и фамилия, четыре кнопки-значка. Долгое нажатие — заметка о ребёнке. */
function StudentRow({ index, student, status, saving, hasNote, onChange, onOpenNote }: RowProps) {
  const fullName = `${student.firstName} ${student.lastName}`.trim()
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()

  return (
    <View style={styles.row}>
      <Pressable
        onLongPress={onOpenNote}
        accessibilityHint={uiText("Долгое нажатие: заметка о ребёнке")}
        style={styles.rowInfo}
      >
        <View style={[styles.avatar, { backgroundColor: AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length] }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.first} numberOfLines={1}>
            {student.firstName}
            {hasNote ? '  •' : ''}
            {saving ? '  …' : ''}
          </Text>
          <Text style={styles.last} numberOfLines={1}>
            {student.lastName}
          </Text>
        </View>
      </Pressable>

      <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel={uiText("Статус: {0}", fullName)}>
        {STATUSES.map((st) => {
          const active = status === st.key
          const Icon = st.icon
          return (
            <Pressable
              key={st.key}
              onPress={() => onChange(st.key)}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={st.label}
              style={[styles.segBtn, { backgroundColor: active ? st.solid : 'rgba(16,40,42,0.05)', opacity: saving ? 0.6 : 1 }]}
            >
              <Icon size={20} color={active ? st.onSolid : st.idle} strokeWidth={2.4} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 96 },
  header: { marginBottom: 12, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.muted },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  counter: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  counterText: { fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  rowInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#0B3A3B' },
  first: { fontSize: 15, fontWeight: '800', color: colors.text },
  last: { fontSize: 12, fontWeight: '600', color: colors.muted },
  seg: { flexDirection: 'row', gap: 5 },
  segBtn: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  saveBar: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  save: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0D7A7C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#075B5D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  saveText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
}))
