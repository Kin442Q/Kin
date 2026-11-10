import { localizeCopy, uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import dayjs from 'dayjs'
import { GraduationCap } from 'lucide-react-native'

import Screen from '../components/Screen'
import EmptyState from '../components/EmptyState'
import GradientView from '../components/GradientView'
import { ScreenHeading } from '../components/ui'
import { colors, shadow } from '../theme/colors'
import { averageColor, gradeTone } from '../lib/gradeStyle'
import { trendLabel, weeklyTrend } from '../lib/gradeTrend'
import { plural } from '../lib/classes'
import { studentApi, type StudentGrades } from '../api/student'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
const TYPE_LABEL: Record<string, string> = localizeCopy({
  CLASSWORK: 'Классная',
  HOMEWORK: 'Домашняя',
  CONTROL: 'Контрольная',
  EXAM: 'Экзамен',
  PROJECT: 'Проект',
  OTHER: 'Другое',
})

/** Оценки ученика: средний балл, предметы с последними оценками и список недавних оценок с комментариями учителя. */
export default function StudentGradesScreen() {
  const [data, setData] = useState<StudentGrades | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await studentApi.grades())
    } catch (e: any) {
      notifyError(e, uiText("Не удалось загрузить оценки"))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const items = data?.items ?? []
  const averages = data?.averages ?? []

  // Последние оценки по предметам (от старых к новым, не больше шести)
  const marksBySubject = useMemo(() => {
    const map = new Map<string, number[]>()
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
    for (const g of sorted) {
      const arr = map.get(g.subject.id) ?? []
      arr.push(g.value)
      map.set(g.subject.id, arr)
    }
    return map
  }, [items, uiLanguage()])

  const overall = averages.length ? averages.reduce((s, a) => s + a.average, 0) / averages.length : null
  const trend = useMemo(
    () => weeklyTrend(items.map((g) => ({ subjectId: g.subject.id, value: g.value, date: g.date }))),
    [items, uiLanguage()],
  )

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
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              load()
            }}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeading
          eyebrow={items.length ? `${items.length} ${plural(items.length, [uiText("оценка"), uiText("оценки"), uiText("оценок")])}` : undefined}
          title={uiText("Оценки")}
          size={28}
        />

        {items.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={34} color={colors.muted} />}
            title={uiText("Оценок пока нет")}
            hint={uiText("Они появятся здесь, когда учитель их выставит")}
          />
        ) : (
          <>
            <GradientView from="#12898A" to="#075B5D" style={[styles.avgCard, shadow.lg]}>
              <View style={{ gap: 2 }}>
                <Text style={styles.avgLabel}>{uiText("Средний балл")}</Text>
                <Text style={styles.avgValue}>{overall != null ? overall.toFixed(1) : '—'}</Text>
              </View>
              {trend != null && (
                <View style={styles.avgChip}>
                  <Text style={styles.avgChipText}>{trendLabel(trend)}</Text>
                </View>
              )}
            </GradientView>

            {averages.map((a) => {
              const marks = (marksBySubject.get(a.subject.id) ?? []).slice(-6)
              return (
                <View key={a.subject.id} style={styles.subjectRow}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.subjectName} numberOfLines={1}>
                      {a.subject.name}
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
                  <Text style={[styles.avg, { color: averageColor(a.average) }]}>{a.average.toFixed(1)}</Text>
                </View>
              )
            })}

            <Text style={styles.sectionTitle}>{uiText("Последние оценки")}</Text>
            {items.slice(0, 20).map((g) => {
              const tone = gradeTone(g.value)
              return (
                <View key={g.id} style={styles.recentRow}>
                  <View style={[styles.recentBadge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.recentBadgeText, { color: tone.fg }]}>{g.value}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subjectName}>{g.subject.name}</Text>
                    <Text style={styles.meta}>
                      {TYPE_LABEL[g.type] ?? g.type} · {dayjs(g.date).format('D MMM')}
                    </Text>
                    {g.comment ? <Text style={styles.comment}>{g.comment}</Text> : null}
                  </View>
                </View>
              )
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  avgCard: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avgLabel: { fontSize: 13, color: '#BDEBE8' },
  avgValue: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.8 },
  avgChip: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  avgChipText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  subjectName: { fontSize: 15, fontWeight: '800', color: colors.text },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 14, fontWeight: '800' },
  avg: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, color: colors.text, marginTop: 6 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  recentBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recentBadgeText: { fontSize: 20, fontWeight: '800' },
  meta: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 2 },
  comment: { fontSize: 13, color: colors.textMid, marginTop: 4 },
}))
