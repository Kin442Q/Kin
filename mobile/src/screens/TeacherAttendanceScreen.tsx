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
import { ListChecks, Lock, StickyNote } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { Chip, ScreenHeading } from '../components/ui'
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

import { themedStyles, themedValue } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
import { useMyClasses } from '../lib/useMyClasses'
interface Row {
  student: StudentDto
  status: AttendanceStatus | null
}

/** Четыре статуса из макета: выбранный — залитая плашка своего цвета. */
const STATUSES = themedValue<Array<{
  key: AttendanceStatus
  label: string
  solid: string
  onSolid: string
}>>(() => ([
  { key: 'PRESENT', label: 'Здесь', solid: colors.primary, onSolid: '#FFFFFF' },
  { key: 'ABSENT', label: 'Нет', solid: colors.text, onSolid: colors.bg },
  { key: 'SICK', label: 'Болеет', solid: colors.coral, onSolid: '#10282A' },
  { key: 'VACATION', label: 'Отпуск', solid: '#F6C46A', onSolid: '#10282A' },
]))

export default function TeacherAttendanceScreen() {
  const L = useLabels()
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

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
      notifyError(e, { title: 'Не сохранилось' })
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
  }, [marks, students])

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
            <ScreenHeading
              eyebrow={groupId ? `${classes.find((c) => c.id === groupId)?.name ?? ''} · ${dayjs().format('D MMMM')}` : dayjs().format('dddd, D MMMM')}
              title="Посещаемость"
            />
            {classes.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={styles.section}>Класс</Text>
                <ClassPicker classes={classes} value={groupId} onChange={setGroupId} />
              </View>
            )}
            {!!groupId && (
              <>
                <View style={styles.counters}>
                  <Chip tone="solid" label={`Здесь ${counts.present}`} />
                  <Chip tone="glass" label={`Нет ${counts.absent}`} />
                  <Chip tone="coral" label={`Болеет ${counts.sick}`} />
                  <Chip tone="glass" label={`Отпуск ${counts.vacation}`} />
                </View>
                <Text style={styles.autosave}>
                  Отмечено {counts.marked} из {counts.total} · сохраняется сразу, родители видят отметку
                </Text>
              </>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <StudentRow
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
              title="Нет доступа к классам"
              hint="Администратор ещё не открыл вам классы. Попросите его в разделе «Доступ учителей»."
            />
          ) : !groupId ? (
            <EmptyState
              icon={<ListChecks size={34} color={colors.muted} />}
              title="Выберите класс"
              hint="Пока класс не выбран, список скрыт — так отметка не попадёт не тому классу."
            />
          ) : studentsLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <EmptyState title="В этом классе пока никого нет" />
          )
        }
      />

      <BottomModal
        visible={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={
          noteFor
            ? `Заметка о ${noteFor.firstName} ${noteFor.lastName}`
            : 'Заметка'
        }
      >
        <Select<Mood>
          label="Настроение"
          value={noteMood}
          onChange={setNoteMood}
          options={[
            { value: 'HAPPY', label: '😊 Хорошее' },
            { value: 'NEUTRAL', label: '😐 Обычное' },
            { value: 'SAD', label: '😟 Грустное' },
            { value: 'SICK', label: '🤒 Болел' },
          ]}
          columns={2}
        />

        {L.institution === 'садик' && (
          <Select<NapQuality>
            label="Сон"
            value={noteNap}
            onChange={setNoteNap}
            options={[
              { value: 'GOOD', label: 'Хорошо' },
              { value: 'NORMAL', label: 'Обычно' },
              { value: 'POOR', label: 'Плохо' },
              { value: 'NO_NAP', label: 'Не спал' },
            ]}
            columns={2}
          />
        )}

        <Field
          label="Заметка"
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Что хочется передать родителям"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Btn block size="lg" loading={noteSaving} onPress={saveNote}>
          Сохранить заметку
        </Btn>
      </BottomModal>
    </Screen>
  )
}

interface RowProps {
  student: StudentDto
  status: AttendanceStatus | null
  saving: boolean
  hasNote: boolean
  onChange: (s: AttendanceStatus) => void
  onOpenNote: () => void
}

function StudentRow({
  student,
  status,
  saving,
  hasNote,
  onChange,
  onOpenNote,
}: RowProps) {
  const fullName = `${student.firstName} ${student.lastName}`.trim()
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()

  return (
    <Card padding={10} elevation="none" style={{ gap: 6 }}>
      <View style={styles.rowTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {fullName}
          {saving ? '  …' : ''}
        </Text>
        <Pressable
          onPress={onOpenNote}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Заметка о ${fullName}`}
          style={[styles.noteBtn, hasNote && { backgroundColor: colors.primarySoft }]}
        >
          <StickyNote size={16} color={hasNote ? colors.primaryDeep : colors.muted} />
        </Pressable>
      </View>

      <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel="Статус">
        {STATUSES().map((s) => {
          const active = status === s.key
          return (
            <Pressable
              key={s.key}
              onPress={() => onChange(s.key)}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={s.label}
              style={[
                styles.segBtn,
                { backgroundColor: active ? s.solid : colors.surfaceAlt, opacity: saving ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.segText, { color: active ? s.onSolid : colors.textMid }]}>{s.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </Card>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 24 },
  header: { marginBottom: 12, gap: 10 },
  section: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  autosave: { fontSize: 12, color: colors.textMid },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: colors.text },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  seg: { flexDirection: 'row', gap: 6 },
  segBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 12, fontWeight: '600' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  noteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    marginLeft: 8,
  },
}))
