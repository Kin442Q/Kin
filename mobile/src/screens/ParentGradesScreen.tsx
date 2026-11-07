import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import dayjs from 'dayjs'
import { ChevronDown } from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { ScreenHeading } from '../components/ui'
import { colors, radius } from '../theme/colors'
import { averageColor, gradeTone } from '../lib/gradeStyle'
import { trendLabel, weeklyTrend } from '../lib/gradeTrend'
import { hasFeature } from '../lib/features'
import { useAuthStore } from '../store/authStore'
import {
  parentApi,
  type GradeStatsRow,
  type KidDto,
  type ParentGradeDto,
  type ParentHomeworkDto,
} from '../api/parent'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
/** Оценки и домашние задания ребёнка: средний балл, предметы с последними оценками. */
export default function ParentGradesScreen() {
  const user = useAuthStore((s) => s.user)
  const showHomework = hasFeature(user, 'homework')

  const [kids, setKids] = useState<KidDto[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [grades, setGrades] = useState<ParentGradeDto[]>([])
  const [stats, setStats] = useState<GradeStatsRow[]>([])
  const [homework, setHomework] = useState<ParentHomeworkDto[]>([])
  const [tab, setTab] = useState<'grades' | 'homework'>('grades')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadKids = useCallback(async () => {
    try {
      const list = await parentApi.myKids()
      setKids(list)
      if (list.length && !activeKidId) setActiveKidId(list[0].id)
      else if (!list.length) setLoading(false)
    } catch (e: any) {
      notifyError(e)
      setLoading(false)
    }
  }, [activeKidId])

  const loadData = useCallback(async () => {
    if (!activeKidId) return
    try {
      const [g, s, h] = await Promise.all([
        parentApi.grades(activeKidId),
        parentApi.gradeStats(activeKidId),
        showHomework ? parentApi.homework(activeKidId).catch(() => [] as ParentHomeworkDto[]) : Promise.resolve([] as ParentHomeworkDto[]),
      ])
      setGrades(g)
      setStats(s)
      setHomework(h)
    } catch (e: any) {
      notifyError(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeKidId, showHomework])

  useEffect(() => {
    loadKids()
  }, [loadKids])
  useEffect(() => {
    if (activeKidId) loadData()
  }, [activeKidId, loadData])

  // Последние оценки по предметам (от старых к новым, не больше шести)
  const marksBySubject = useMemo(() => {
    const map = new Map<string, number[]>()
    const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date))
    for (const g of sorted) {
      const arr = map.get(g.subjectId) ?? []
      arr.push(g.value)
      map.set(g.subjectId, arr)
    }
    return map
  }, [grades])

  const kid = kids.find((k) => k.id === activeKidId) ?? kids[0]
  const rows = stats.filter((s) => s.count > 0)
  const overall = rows.length ? rows.reduce((a, r) => a + r.average, 0) / rows.length : null
  // Как изменился средний балл за неделю; null, если сравнивать не с чем или он не изменился
  const trend = useMemo(() => weeklyTrend(grades), [grades])
  const upcoming = [...homework]
    .filter((h) => !dayjs(h.dueDate).isBefore(dayjs().startOf('day')))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }
  if (!kid) {
    return (
      <Screen>
        <EmptyState title="Нет данных" hint="К вашему аккаунту пока не привязан ни один ученик." />
      </Screen>
    )
  }

  const cycleKid = () => {
    if (kids.length < 2) return
    const i = kids.findIndex((k) => k.id === kid.id)
    setActiveKidId(kids[(i + 1) % kids.length].id)
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              loadData()
            }}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeading
          eyebrow={`${kid.firstName}${kid.group?.name ? ' · ' + kid.group.name : ''}`}
          title="Оценки"
          right={
            kids.length > 1 ? (
              <Pressable onPress={cycleKid} accessibilityRole="button" accessibilityLabel="Сменить ребёнка" style={styles.switch}>
                <Text style={styles.switchText}>{kid.firstName}</Text>
                <ChevronDown size={15} color={colors.textMid} />
              </Pressable>
            ) : undefined
          }
        />

        {showHomework && (
          <View style={styles.seg} accessibilityRole="tablist">
            {(['grades', 'homework'] as const).map((m) => {
              const on = tab === m
              return (
                <Pressable
                  key={m}
                  onPress={() => setTab(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.segItem, on && styles.segOn]}
                >
                  <Text style={[styles.segText, on && { color: '#FFFFFF' }]}>{m === 'grades' ? 'Оценки' : 'Домашние задания'}</Text>
                </Pressable>
              )
            })}
          </View>
        )}

        {tab === 'grades' ? (
          <>
            <View style={styles.avgCard}>
              <View style={{ gap: 2 }}>
                <Text style={styles.avgLabel}>Средний балл</Text>
                <Text style={styles.avgValue}>{overall != null ? overall.toFixed(1) : '—'}</Text>
              </View>
              <View style={styles.avgChip}>
                <Text style={styles.avgChipText}>
                  {trend != null
                    ? trendLabel(trend)
                    : `${grades.length} ${grades.length === 1 ? 'оценка' : grades.length < 5 && grades.length > 0 ? 'оценки' : 'оценок'}`}
                </Text>
              </View>
            </View>

            {rows.length === 0 ? (
              <EmptyState title="Оценок пока нет" hint="Они появятся здесь, как только учитель поставит первую." />
            ) : (
              rows.map((r) => {
                const marks = (marksBySubject.get(r.subjectId) ?? []).slice(-6)
                return (
                  <Card key={r.subjectId} padding={12} style={styles.subjectRow}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.subjectName} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <View style={styles.marks}>
                        {marks.map((v, i) => {
                          const tone = gradeTone(v)
                          return (
                            <View key={i} style={[styles.mark, { backgroundColor: tone.bg }]}>
                              <Text style={[styles.markText, { color: tone.fg }]}>{v}</Text>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                    <Text style={[styles.avg, { color: averageColor(r.average) }]}>{r.average.toFixed(1)}</Text>
                  </Card>
                )
              })
            )}
          </>
        ) : upcoming.length === 0 ? (
          <EmptyState title="Заданий нет" hint="Ближайших домашних заданий не найдено." />
        ) : (
          upcoming.map((h) => (
            <Card key={h.id} padding={14} style={{ gap: 4 }}>
              <View style={styles.hwHead}>
                <Text style={styles.subjectName} numberOfLines={1}>
                  {h.subject?.name ?? 'Задание'}
                </Text>
                <Text style={styles.due}>до {dayjs(h.dueDate).format('D MMM')}</Text>
              </View>
              <Text style={styles.hwText}>{h.title}</Text>
              {h.description ? <Text style={styles.hwDesc}>{h.description}</Text> : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 12 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  switchText: { fontSize: 13, fontWeight: '700', color: colors.text },
  seg: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 16, backgroundColor: colors.surface },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '700', color: colors.text },
  avgCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avgLabel: { fontSize: 13, color: '#BDEBE8' },
  avgValue: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.8 },
  avgChip: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  avgChipText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subjectName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  marks: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  mark: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 13, fontWeight: '800' },
  avg: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  hwHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  due: { fontSize: 12, fontWeight: '700', color: colors.roseDeep },
  hwText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  hwDesc: { fontSize: 13, color: colors.textMid, lineHeight: 18 },
}))
