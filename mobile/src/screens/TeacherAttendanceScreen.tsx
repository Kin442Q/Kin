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
import dayjs from 'dayjs'
import { Check, Heart, MinusCircle, Sun } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import { colors, radius, shadow } from '../theme/colors'
import { studentsApi, type StudentDto } from '../api/students'
import {
  attendanceApi,
  type AttendanceDto,
  type AttendanceStatus,
} from '../api/attendance'

interface Row {
  student: StudentDto
  status: AttendanceStatus | null
}

const STATUSES: Array<{
  key: AttendanceStatus
  label: string
  short: string
  bg: string
  fg: string
  icon: typeof Check
}> = [
  {
    key: 'PRESENT',
    label: 'Здесь',
    short: 'Здесь',
    bg: colors.primarySoft,
    fg: colors.primaryDeep,
    icon: Check,
  },
  {
    key: 'ABSENT',
    label: 'Нет',
    short: 'Нет',
    bg: colors.roseSoft,
    fg: colors.roseDeep,
    icon: MinusCircle,
  },
  {
    key: 'SICK',
    label: 'Болеет',
    short: 'Бол.',
    bg: colors.yellowSoft,
    fg: colors.yellowDeep,
    icon: Heart,
  },
  {
    key: 'VACATION',
    label: 'Отпуск',
    short: 'Отп.',
    bg: colors.lilacSoft,
    fg: colors.lilacDeep,
    icon: Sun,
  },
]

export default function TeacherAttendanceScreen() {
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

  const [students, setStudents] = useState<StudentDto[]>([])
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [list, attendance] = await Promise.all([
        studentsApi.list({ status: 'ACTIVE' }),
        attendanceApi.listByDay(today),
      ])
      setStudents(list)
      const map: Record<string, AttendanceStatus> = {}
      for (const a of attendance) map[a.studentId] = a.status
      setMarks(map)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [today])

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
      Alert.alert('Не сохранилось', e?.response?.data?.message || String(e))
    } finally {
      setSavingId(null)
    }
  }

  const counts = useMemo(() => {
    const total = students.length
    const marked = Object.keys(marks).length
    const present = Object.values(marks).filter((s) => s === 'PRESENT').length
    const absent = Object.values(marks).filter(
      (s) => s === 'ABSENT' || s === 'SICK' || s === 'VACATION',
    ).length
    return { total, marked, present, absent }
  }, [marks, students])

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
      <FlatList
        data={students}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              reload()
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Посещаемость</Text>
            <Text style={styles.date}>{dayjs().format('dddd, D MMMM')}</Text>

            <View style={styles.kpiRow}>
              <Card padding={14} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Отмечено</Text>
                <Text style={styles.kpiValue}>
                  {counts.marked}
                  <Text style={styles.kpiTotal}> / {counts.total}</Text>
                </Text>
              </Card>
              <Card padding={14} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>В саду</Text>
                <Text style={[styles.kpiValue, { color: colors.primaryDeep }]}>
                  {counts.present}
                </Text>
              </Card>
              <Card padding={14} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Нет</Text>
                <Text style={[styles.kpiValue, { color: colors.roseDeep }]}>
                  {counts.absent}
                </Text>
              </Card>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <StudentRow
            student={item}
            status={marks[item.id] ?? null}
            saving={savingId === item.id}
            onChange={(s) => setStatus(item.id, s)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              В вашей группе пока нет активных детей.
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

interface RowProps {
  student: StudentDto
  status: AttendanceStatus | null
  saving: boolean
  onChange: (s: AttendanceStatus) => void
}

function StudentRow({ student, status, saving, onChange }: RowProps) {
  const fullName = `${student.firstName} ${student.lastName}`.trim()
  const current = STATUSES.find((s) => s.key === status)

  return (
    <Card padding={14}>
      <View style={styles.rowTop}>
        <Avatar name={fullName} size={42} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={styles.subtitle}>
            {current ? current.label : 'Не отмечен'}
            {saving ? ' · сохраняем…' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {STATUSES.map((s) => {
          const active = status === s.key
          const Icon = s.icon
          return (
            <Pressable
              key={s.key}
              onPress={() => onChange(s.key)}
              disabled={saving}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? s.bg : colors.surface,
                  borderColor: active ? s.fg : colors.border,
                  opacity: saving ? 0.6 : 1,
                },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Icon
                size={14}
                color={active ? s.fg : colors.muted}
                strokeWidth={2.4}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: active ? s.fg : colors.textMid },
                ]}
              >
                {s.short}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 14,
  },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, ...shadow.sm },
  kpiLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  kpiTotal: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
})
