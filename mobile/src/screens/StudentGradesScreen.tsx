import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import dayjs from 'dayjs'
import { GraduationCap } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import { studentApi, type StudentGrades } from '../api/student'

const TYPE_LABEL: Record<string, string> = {
  CLASSWORK: 'Классная',
  HOMEWORK: 'Домашняя',
  CONTROL: 'Контрольная',
  EXAM: 'Экзамен',
  PROJECT: 'Проект',
  OTHER: 'Другое',
}

const gradeTone = (v: number) =>
  v >= 4.5
    ? { bg: colors.primarySoft, fg: colors.primaryDeep }
    : v >= 3.5
      ? { bg: colors.blueSoft, fg: colors.blueDeep }
      : v >= 2.5
        ? { bg: colors.yellowSoft, fg: colors.yellowDeep }
        : { bg: colors.roseSoft, fg: colors.roseDeep }

/** Оценки ученика: средний балл по предметам и последние оценки. */
export default function StudentGradesScreen() {
  const [data, setData] = useState<StudentGrades | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await studentApi.grades())
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось загрузить оценки')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const items = data?.items ?? []
  const averages = data?.averages ?? []

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
        <Text style={styles.title}>Мои оценки</Text>

        {items.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={34} color={colors.muted} />}
            title="Оценок пока нет"
            hint="Они появятся здесь, когда учитель их выставит"
          />
        ) : (
          <>
            <Text style={styles.section}>Средний балл</Text>
            <View style={styles.avgGrid}>
              {averages.map((a) => {
                const tone = gradeTone(a.average)
                return (
                  <Card key={a.subject.id} padding={12} style={styles.avgCard}>
                    <Text style={styles.avgSubject} numberOfLines={1}>
                      {a.subject.name}
                    </Text>
                    <Text style={[styles.avgValue, { color: tone.fg }]}>
                      {a.average.toFixed(1)}
                    </Text>
                    <Text style={styles.meta}>оценок: {a.count}</Text>
                  </Card>
                )
              })}
            </View>

            <Text style={styles.section}>Последние оценки</Text>
            <View style={{ gap: 8 }}>
              {items.map((g) => {
                const tone = gradeTone(g.value)
                return (
                  <Card key={g.id} padding={12} style={styles.gradeRow}>
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>{g.value}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.avgSubject}>{g.subject.name}</Text>
                      <Text style={styles.meta}>
                        {TYPE_LABEL[g.type] ?? g.type} · {dayjs(g.date).format('D MMM')}
                      </Text>
                      {g.comment ? <Text style={styles.comment}>{g.comment}</Text> : null}
                    </View>
                  </Card>
                )
              })}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMid,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avgCard: { flexBasis: '47%', flexGrow: 1 },
  avgSubject: { fontSize: 14, fontWeight: '700', color: colors.text },
  avgValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 20, fontWeight: '800' },
  comment: { fontSize: 13, color: colors.textMid, marginTop: 4 },
})
