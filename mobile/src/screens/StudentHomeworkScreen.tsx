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
import { BookOpen, Check } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import {
  STATUS_LABEL,
  studentApi,
  type StudentHomework,
  type SubmissionStatus,
} from '../api/student'

import { themedStyles, themedValue } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
type Filter = 'open' | 'done' | 'past'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'open', label: 'Активные' },
  { key: 'done', label: 'Сдано' },
  { key: 'past', label: 'Прошедшие' },
]

const STATUS_TONE = themedValue<Record<SubmissionStatus, { bg: string; fg: string }>>(() => ({
  SUBMITTED: { bg: colors.blueSoft, fg: colors.blueDeep },
  DONE: { bg: colors.primarySoft, fg: colors.primaryDeep },
  PARTIAL: { bg: colors.yellowSoft, fg: colors.yellowDeep },
  NOT_DONE: { bg: colors.roseSoft, fg: colors.roseDeep },
}))

const isVerdict = (s: SubmissionStatus | null | undefined) =>
  s === 'DONE' || s === 'PARTIAL' || s === 'NOT_DONE'

/** Домашние задания ученика: что сделать, что сдано и что уже прошло. */
export default function StudentHomeworkScreen() {
  const [items, setItems] = useState<StudentHomework[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')

  const load = useCallback(async () => {
    try {
      // с запасом назад: 60 дней
      setItems(
        await studentApi.homework({
          from: dayjs().subtract(60, 'day').format('YYYY-MM-DD'),
        }),
      )
    } catch (e: any) {
      notifyError(e, 'Не удалось загрузить задания')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const today = dayjs().startOf('day')
    return items.filter((h) => {
      const status = h.submission?.status ?? null
      const checked = isVerdict(status)
      const past = dayjs(h.dueDate).isBefore(today)
      if (filter === 'open') return !checked && !past
      if (filter === 'done') return checked || status === 'SUBMITTED'
      return past && !checked
    })
  }, [items, filter])

  const toggle = async (h: StudentHomework) => {
    const submitted = h.submission?.status === 'SUBMITTED'
    setBusyId(h.id)
    try {
      const r = await studentApi.setSubmitted(h.id, !submitted)
      setItems((list) =>
        list.map((x) =>
          x.id === h.id
            ? {
                ...x,
                submission: r.status
                  ? { status: r.status, comment: null, updatedAt: new Date().toISOString() }
                  : null,
              }
            : x,
        ),
      )
    } catch (e: any) {
      notifyError(e, 'Не удалось отметить')
    } finally {
      setBusyId(null)
    }
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
      <View style={styles.header}>
        <Text style={styles.title}>Домашние задания</Text>
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const on = f.key === filter
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  { backgroundColor: on ? colors.primary : colors.surfaceAlt },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]}>
                  {f.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
        ListEmptyComponent={
          <EmptyState
            icon={<BookOpen size={34} color={colors.muted} />}
            title={filter === 'open' ? 'Заданий нет' : 'Здесь пока пусто'}
            hint={filter === 'open' ? 'Все задания выполнены — отлично!' : undefined}
          />
        }
        renderItem={({ item: h }) => {
          const status = h.submission?.status ?? null
          const verdict = isVerdict(status) ? status : null
          const submitted = status === 'SUBMITTED'
          const overdue = dayjs(h.dueDate).endOf('day').isBefore(dayjs()) && !status
          return (
            <Card padding={14} style={overdue ? { opacity: 0.75 } : undefined}>
              <View style={styles.row}>
                <View style={[styles.date, { backgroundColor: `${h.subject.color}22` }]}>
                  <Text style={[styles.dateDay, { color: h.subject.color }]}>
                    {dayjs(h.dueDate).format('DD')}
                  </Text>
                  <Text style={[styles.dateMonth, { color: h.subject.color }]}>
                    {dayjs(h.dueDate).format('MMM')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subject}>{h.subject.name}</Text>
                  <Text style={styles.hwTitle}>{h.title}</Text>
                  {h.description ? <Text style={styles.desc}>{h.description}</Text> : null}
                  {verdict && h.submission?.comment ? (
                    <Text style={styles.desc}>Учитель: {h.submission.comment}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.footer}>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {overdue && (
                    <Text style={[styles.badge, { backgroundColor: colors.roseSoft, color: colors.roseDeep }]}>
                      срок прошёл
                    </Text>
                  )}
                  {status && (
                    <Text
                      style={[
                        styles.badge,
                        { backgroundColor: STATUS_TONE()[status].bg, color: STATUS_TONE()[status].fg },
                      ]}
                    >
                      {submitted ? 'Ждёт проверки учителя' : STATUS_LABEL[status]}
                    </Text>
                  )}
                </View>
                {/* Вердикт учителя ученик не меняет — кнопки нет */}
                {!verdict && (
                  <Btn
                    size="sm"
                    variant={submitted ? 'secondary' : 'primary'}
                    loading={busyId === h.id}
                    icon={submitted ? <Check size={14} color={colors.primaryDeep} /> : undefined}
                    onPress={() => toggle(h)}
                  >
                    {submitted ? 'Сделал(а)' : 'Я сделал(а)'}
                  </Btn>
                )}
              </View>
            </Card>
          )
        }}
      />
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  row: { flexDirection: 'row', gap: 12 },
  date: { width: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  dateDay: { fontSize: 20, fontWeight: '800' },
  dateMonth: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  subject: { fontSize: 12, fontWeight: '700', color: colors.muted },
  hwTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
  desc: { fontSize: 13, color: colors.textMid, marginTop: 4, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
}))
