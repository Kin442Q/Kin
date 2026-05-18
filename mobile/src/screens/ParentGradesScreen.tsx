import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { ChevronLeft, GraduationCap, BookOpen } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors, radius, shadow } from '../theme/colors'
import {
  parentApi,
  type KidDto,
  type ParentGradeDto,
  type ParentHomeworkDto,
  type GradeStatsRow,
} from '../api/parent'

export default function ParentGradesScreen() {
  const navigation = useNavigation()
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
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
      setLoading(false)
    }
  }, [activeKidId])

  const loadData = useCallback(async () => {
    if (!activeKidId) return
    try {
      const [g, s, h] = await Promise.all([
        parentApi.grades(activeKidId),
        parentApi.gradeStats(activeKidId),
        parentApi.homework(activeKidId),
      ])
      setGrades(g)
      setStats(s)
      setHomework(h)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeKidId])

  useEffect(() => {
    loadKids()
  }, [loadKids])

  useEffect(() => {
    if (activeKidId) loadData()
  }, [activeKidId, loadData])

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
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Школа</Text>
        <View style={{ width: 36 }} />
      </View>

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
        {kids.length > 1 && (
          <View style={styles.kidTabs}>
            {kids.map((k) => {
              const on = k.id === activeKidId
              return (
                <Pressable
                  key={k.id}
                  onPress={() => setActiveKidId(k.id)}
                  style={[
                    styles.kidChip,
                    {
                      backgroundColor: on ? colors.primary : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: on ? '#fff' : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {k.firstName}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}

        <View style={styles.modeTabs}>
          {(['grades', 'homework'] as const).map((m) => {
            const on = tab === m
            return (
              <Pressable
                key={m}
                onPress={() => setTab(m)}
                style={[
                  styles.modeTab,
                  { backgroundColor: on ? colors.primary : colors.surfaceAlt },
                ]}
              >
                <Text
                  style={{
                    color: on ? '#fff' : colors.text,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {m === 'grades' ? 'Оценки' : 'Домашка'}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {tab === 'grades' ? (
          <>
            {stats.length > 0 && (
              <>
                <Text style={styles.section}>Средняя по предметам</Text>
                {stats.map((row) => (
                  <Card key={row.subjectId} padding={12} style={shadow.sm}>
                    <View style={styles.statRow}>
                      <View
                        style={[styles.dot, { backgroundColor: row.color }]}
                      />
                      <Text style={styles.statName}>{row.name}</Text>
                      <Text
                        style={[
                          styles.statValue,
                          { color: gradeColor(row.average) },
                        ]}
                      >
                        {row.average.toFixed(1)}
                      </Text>
                      <Text style={styles.statCount}>{row.count} оц.</Text>
                    </View>
                  </Card>
                ))}
              </>
            )}

            <Text style={styles.section}>Все оценки</Text>
            {grades.length === 0 ? (
              <Card padding={20}>
                <Text style={styles.empty}>Оценок пока нет</Text>
              </Card>
            ) : (
              grades.map((g) => (
                <Card key={g.id} padding={12}>
                  <View style={styles.gradeRow}>
                    <View
                      style={[
                        styles.gradeCircle,
                        { backgroundColor: gradeColor(g.value) },
                      ]}
                    >
                      <Text style={styles.gradeCircleText}>{g.value}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.subjectName}>
                        {g.subject?.name ?? '—'}
                      </Text>
                      <Text style={styles.subjectMeta}>
                        {dayjs(g.date).format('D MMMM')} ·{' '}
                        {gradeTypeLabel(g.type)}
                        {g.author ? ` · ${g.author.fullName}` : ''}
                      </Text>
                      {g.comment && (
                        <Text style={styles.comment}>«{g.comment}»</Text>
                      )}
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={styles.section}>Заданное</Text>
            {homework.length === 0 ? (
              <Card padding={20}>
                <Text style={styles.empty}>Домашних заданий нет</Text>
              </Card>
            ) : (
              homework.map((h) => {
                const overdue =
                  new Date(h.dueDate).getTime() < Date.now() - 86400000
                return (
                  <Card
                    key={h.id}
                    padding={14}
                    style={overdue ? { opacity: 0.55 } : undefined}
                  >
                    <View style={styles.hwRow}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: h.subject?.color ?? colors.primary,
                            marginTop: 6,
                          },
                        ]}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.hwTitle}>{h.title}</Text>
                        <Text style={styles.hwMeta}>
                          {h.subject?.name ?? '—'} · до{' '}
                          {dayjs(h.dueDate).format('dd, D MMM')}
                          {overdue ? ' (просрочено)' : ''}
                        </Text>
                        {h.description && (
                          <Text style={styles.hwDesc}>{h.description}</Text>
                        )}
                      </View>
                    </View>
                  </Card>
                )
              })
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function gradeColor(v: number): string {
  if (v >= 9) return colors.primaryDeep
  if (v >= 7) return colors.primary
  if (v >= 5) return colors.yellowDeep
  if (v >= 4) return colors.yellowDeep
  return colors.roseDeep
}
function gradeTypeLabel(t: string): string {
  if (t === 'CLASSWORK') return 'урок'
  if (t === 'HOMEWORK') return 'ДЗ'
  if (t === 'CONTROL') return 'контрольная'
  if (t === 'EXAM') return 'экзамен'
  if (t === 'PROJECT') return 'проект'
  return 'другое'
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
  container: { padding: 16, paddingBottom: 40, gap: 8 },
  kidTabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  kidChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  modeTabs: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  section: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, marginLeft: 10 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginRight: 8 },
  statCount: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  gradeRow: { flexDirection: 'row', alignItems: 'center' },
  gradeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeCircleText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subjectName: { fontSize: 14, fontWeight: '700', color: colors.text },
  subjectMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  comment: { fontSize: 12, color: colors.textMid, fontStyle: 'italic', marginTop: 4 },
  hwRow: { flexDirection: 'row', alignItems: 'flex-start' },
  hwTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  hwMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  hwDesc: { fontSize: 13, color: colors.textMid, marginTop: 6, lineHeight: 18 },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center' },
})
