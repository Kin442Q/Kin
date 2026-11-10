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
import { BookOpen, CalendarDays, Check, Clock } from 'lucide-react-native'

import Screen from '../components/Screen'
import Btn from '../components/Btn'
import IconTile from '../components/IconTile'
import { subjectIcon, tint } from '../lib/subjectIcon'
import { dueLabel } from '../lib/homework'
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

const FILTERS: Array<{ key: Filter; label: string }> = localizeCopy([
  { key: 'open', label: 'Активные' },
  { key: 'done', label: 'Сдано' },
  { key: 'past', label: 'Прошедшие' },
])

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
      notifyError(e, uiText("Не удалось загрузить задания"))
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
  }, [items, filter, uiLanguage()])

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
      notifyError(e, uiText("Не удалось отметить"))
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
        <View style={{ gap: 4 }}>
          <Text style={styles.eyebrow}>{dayjs().format('dddd, D MMMM')}</Text>
          <Text style={styles.title}>{uiText("Домашние задания")}</Text>
        </View>
        <View style={styles.filters} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const on = f.key === filter
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
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
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
            title={filter === 'open' ? uiText("Заданий нет") : uiText("Здесь пока пусто")}
            hint={filter === 'open' ? uiText("Все задания выполнены — отлично!") : undefined}
          />
        }
        renderItem={({ item: h }) => {
          const status = h.submission?.status ?? null
          const verdict = isVerdict(status) ? status : null
          const submitted = status === 'SUBMITTED'
          const overdue = dayjs(h.dueDate).endOf('day').isBefore(dayjs()) && !status
          return (
            <View style={[styles.card, overdue && { opacity: 0.75 }]}>
              <View style={styles.row}>
                <IconTile
                  icon={subjectIcon(h.subject.name)}
                  bg={tint(h.subject.color, 0.18, colors.primarySoft)}
                  fg={h.subject.color}
                  size={40}
                  style={{ borderRadius: 14 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.subject}>{h.subject.name}</Text>
                  <Text style={styles.hwTitle}>{h.title}</Text>
                  {h.description ? <Text style={styles.desc}>{h.description}</Text> : null}
                  {verdict && h.submission?.comment ? (
                    <Text style={styles.desc}>{uiText("Учитель:") + " "}{h.submission.comment}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.footer}>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <View style={[styles.duePill, !status && [uiText("сегодня"), uiText("завтра")].includes(dueLabel(h)) && styles.duePillSoon]}>
                    {!status && [uiText("сегодня"), uiText("завтра")].includes(dueLabel(h)) ? (
                      <Clock size={13} color="#B23E1A" />
                    ) : (
                      <CalendarDays size={13} color={colors.muted} />
                    )}
                    <Text style={[styles.dueText, !status && [uiText("сегодня"), uiText("завтра")].includes(dueLabel(h)) && { color: '#B23E1A' }]}>
                      {dueLabel(h)}
                    </Text>
                  </View>
                  {overdue && (
                    <Text style={[styles.badge, { backgroundColor: colors.roseSoft, color: colors.roseDeep }]}>
                      {" " + uiText("срок прошёл") + " "}</Text>
                  )}
                  {status && (
                    <Text
                      style={[
                        styles.badge,
                        { backgroundColor: STATUS_TONE()[status].bg, color: STATUS_TONE()[status].fg },
                      ]}
                    >
                      {submitted ? uiText("Ждёт проверки учителя") : STATUS_LABEL[status]}
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
                    {submitted ? uiText("Сделал(а)") : uiText("Я сделал(а)")}
                  </Btn>
                )}
              </View>
            </View>
          )
        }}
      />
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.muted },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  filters: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chip: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  chipOn: {
    backgroundColor: colors.surfaceSolid,
    shadowColor: '#10282A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextOn: { color: colors.text, fontWeight: '800' },
  card: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,40,42,0.06)',
  },
  duePillSoon: { backgroundColor: 'rgba(255,138,101,0.22)' },
  dueText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  row: { flexDirection: 'row', gap: 12 },
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
