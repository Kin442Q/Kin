import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Baby, CalendarHeart, ChevronRight, Receipt } from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import Card from '../components/Card'
import { CardTitle, ScreenHeading, Tile } from '../components/ui'
import { colors } from '../theme/colors'
import { gradeKeyOf } from '../lib/classes'
import { hasFeature } from '../lib/features'
import { useAuthStore } from '../store/authStore'
import { http } from '../api/http'
import { adminApi, type AdminStudentDto, type DashboardDto, type GroupDto } from '../api/admin'
import { attendanceApi, type AttendanceDto } from '../api/attendance'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
/** Параллели, объединённые в столбцы диаграммы посещаемости (как в макете). */
const BUCKETS: { label: string; grades: number[] }[] = [
  { label: '1–2', grades: [1, 2] },
  { label: '3–4', grades: [3, 4] },
  { label: '5–6', grades: [5, 6] },
  { label: '7–8', grades: [7, 8] },
  { label: '9', grades: [9] },
  { label: '10–11', grades: [10, 11] },
]

/** Сводка школы для директора: цифры дня, посещаемость по параллелям, на что обратить внимание. */
export default function AdminDashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const navigation = useNavigation<any>()
  const month = useMemo(() => dayjs().format('YYYY-MM'), [])
  const money = hasFeature(user, 'analytics')

  const [groups, setGroups] = useState<(GroupDto & { homeroomTeacher?: { id: string } | null })[]>([])
  const [students, setStudents] = useState<AdminStudentDto[]>([])
  const [marks, setMarks] = useState<AttendanceDto[]>([])
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const [finance, setFinance] = useState<DashboardDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(async () => {
    try {
      const day = dayjs().format('YYYY-MM-DD')
      const [g, s, a, staff, fin] = await Promise.all([
        adminApi.groups(),
        adminApi.students({ status: 'ACTIVE' }),
        hasFeature(user, 'attendance') ? attendanceApi.listByDay(day).catch(() => [] as AttendanceDto[]) : Promise.resolve([] as AttendanceDto[]),
        hasFeature(user, 'staff')
          ? http.get<unknown[]>('/v1/staff').then((r) => (Array.isArray(r.data) ? r.data.length : null)).catch(() => null)
          : Promise.resolve(null),
        money ? adminApi.dashboard(month).catch(() => null) : Promise.resolve(null),
      ])
      setGroups(g)
      setStudents(s)
      setMarks(a)
      setStaffCount(staff)
      setFinance(fin)
    } catch (e: any) {
      notifyError(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [month, money, user])

  useEffect(() => {
    reload()
  }, [reload])

  const gradeOfGroup = useMemo(() => {
    const m = new Map<string, number | 'other'>()
    for (const g of groups) m.set(g.id, gradeKeyOf(g.name))
    return m
  }, [groups])

  if (loading) {
    return (
      <Screen variant="home">
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const present = marks.filter((m) => m.status === 'PRESENT').length
  const todayPct = marks.length ? Math.round((present / marks.length) * 100) : null

  const bars = BUCKETS.map((b) => {
    const inBucket = marks.filter((m) => {
      const k = gradeOfGroup.get(m.groupId)
      return typeof k === 'number' && b.grades.includes(k)
    })
    const ok = inBucket.filter((m) => m.status === 'PRESENT').length
    return { label: b.label, pct: inBucket.length ? Math.round((ok / inBucket.length) * 100) : null }
  })
  const hasBars = bars.some((b) => b.pct != null)

  const noClass = students.filter((s) => !s.groupId).length
  const noTeacher = groups.filter((g) => 'homeroomTeacher' in g && !g.homeroomTeacher)
  const attention: { text: string; warn: boolean }[] = []
  if (noClass > 0) attention.push({ text: `${noClass} ${noClass === 1 ? 'ученик' : noClass < 5 ? 'ученика' : 'учеников'} без класса`, warn: true })
  for (const g of noTeacher.slice(0, 3)) attention.push({ text: `${g.name} — нет классного руководителя`, warn: false })

  const school = user?.institution?.name ?? 'Школа'

  const links: { label: string; icon: React.ReactNode; to: string }[] = [
    { label: 'Ученики', icon: <Baby size={20} color={colors.primaryDeep} />, to: 'AdminStudents' },
  ]
  if (hasFeature(user, 'meetings'))
    links.push({ label: 'Родительские собрания', icon: <CalendarHeart size={20} color={colors.primaryDeep} />, to: 'AdminMeetings' })
  if (hasFeature(user, 'expenses'))
    links.push({ label: 'Расходы', icon: <Receipt size={20} color={colors.primaryDeep} />, to: 'AdminExpenses' })

  return (
    <Screen variant="home">
      <ScrollView
        contentContainerStyle={styles.container}
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
      >
        <ScreenHeading eyebrow={`${school} · ${dayjs().format('dddd, D MMMM')}`} title="Сводка школы" />

        <View style={styles.grid}>
          <Tile label="Учеников" value={students.length} style={styles.cell} />
          <Tile label="Сегодня в школе" value={todayPct != null ? `${todayPct}%` : '—'} tone="teal" style={styles.cell} />
          <Tile label="Классов" value={groups.length} style={styles.cell} />
          <Tile label="Сотрудников" value={staffCount ?? '—'} style={styles.cell} />
        </View>

        {money && finance && (
          <View style={styles.grid}>
            <Tile
              label="Прибыль месяца"
              value={`${Math.round(finance.profit).toLocaleString('ru-RU')} с`}
              hint={`Маржа ${(finance.margin * 100).toFixed(0)}%`}
              style={styles.cell}
            />
            <Tile
              label="Поступления"
              value={`${Math.round(finance.income).toLocaleString('ru-RU')} с`}
              style={styles.cell}
            />
          </View>
        )}

        {hasBars && (
          <Card padding={16} style={{ gap: 10 }}>
            <CardTitle title="Посещаемость по параллелям" />
            <View style={styles.bars}>
              {bars.map((b) => (
                <View key={b.label} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(6, b.pct ?? 0)}%`,
                          backgroundColor: b.pct == null ? 'rgba(16,40,42,0.08)' : b.pct < 90 ? colors.coral : colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{b.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card padding={16} style={{ gap: 8 }}>
          <View style={styles.attHead}>
            <Text style={styles.attTitle}>Требует внимания</Text>
            {attention.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{attention.length}</Text>
              </View>
            )}
          </View>
          {attention.length === 0 ? (
            <Text style={styles.ok}>Всё в порядке: замечаний нет.</Text>
          ) : (
            attention.map((a) => (
              <View
                key={a.text}
                style={[styles.attRow, { backgroundColor: a.warn ? 'rgba(255,138,101,0.2)' : 'rgba(255,255,255,0.7)' }]}
              >
                <Text style={styles.attText}>{a.text}</Text>
              </View>
            ))
          )}
        </Card>

        <Card padding={6}>
          {links.map((l, i) => (
            <Pressable
              key={l.to}
              onPress={() => navigation.navigate(l.to)}
              accessibilityRole="button"
              style={[styles.link, i > 0 && styles.linkBorder]}
            >
              <View style={styles.linkIcon}>{l.icon}</View>
              <Text style={styles.linkText}>{l.label}</Text>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexBasis: '47%', flexGrow: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 110 },
  barCol: { flex: 1, height: '100%', alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 8 },
  barLabel: { fontSize: 11, color: colors.textMid },
  attHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.coral },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.text },
  ok: { fontSize: 14, color: colors.textMid },
  attRow: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  attText: { fontSize: 14, color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 10 },
  linkBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
}))
