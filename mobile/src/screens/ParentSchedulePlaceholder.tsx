import { localizeCopy, uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import dayjs from 'dayjs'
import { ChevronDown } from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import EmptyState from '../components/EmptyState'
import { ScreenHeading } from '../components/ui'
import { colors, radius } from '../theme/colors'
import { parentApi, type KidDto, type ScheduleItemDto } from '../api/parent'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
/** Цветная полоса урока по порядку в дне (палитра макета). */
const BAR = ['#0D7A7C', '#FF8A65', '#9EDDD9', '#F6C46A', '#0D7A7C', '#FF8A65', '#9EDDD9', '#F6C46A']
const WEEKDAYS = localizeCopy(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'])

/** Расписание ребёнка на неделю: выбор дня и список уроков. */
export default function ParentScheduleScreen() {
  const todayDow = dayjs().day() === 0 ? 7 : dayjs().day() // 1..7, Пн..Вс

  const [kids, setKids] = useState<KidDto[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItemDto[]>([])
  const [activeDay, setActiveDay] = useState<number>(todayDow > 6 ? 1 : todayDow)
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

  const loadSchedule = useCallback(async () => {
    if (!activeKidId) return
    try {
      setSchedule(await parentApi.schedule(activeKidId))
    } catch (e: any) {
      notifyError(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeKidId])

  useEffect(() => {
    loadKids()
  }, [loadKids])
  useEffect(() => {
    if (activeKidId) loadSchedule()
  }, [activeKidId, loadSchedule])

  // Даты текущей недели: понедельник … суббота
  const week = useMemo(() => {
    const monday = dayjs().startOf('day').subtract(todayDow - 1, 'day')
    return WEEKDAYS.map((label, i) => ({ dow: i + 1, label, date: monday.add(i, 'day') }))
  }, [todayDow, uiLanguage()])

  const kid = kids.find((k) => k.id === activeKidId) ?? kids[0]
  const dayLessons = schedule
    .filter((l) => l.dayOfWeek === activeDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const nowMin = dayjs().hour() * 60 + dayjs().minute()
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

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
        <EmptyState title={uiText("Нет данных")} hint={uiText("К вашему аккаунту пока не привязан ни один ученик.")} />
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
              loadSchedule()
            }}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeading
          eyebrow={`${kid.firstName}${kid.group?.name ? ' · ' + kid.group.name : ''}`}
          title={uiText("Расписание")}
          size={28}
          right={
            kids.length > 1 ? (
              <Pressable onPress={cycleKid} accessibilityRole="button" accessibilityLabel={uiText("Сменить ребёнка")} style={styles.switch}>
                <Text style={styles.switchText}>{kid.firstName}</Text>
                <ChevronDown size={15} color={colors.textMid} />
              </Pressable>
            ) : undefined
          }
        />

        <View style={styles.days} accessibilityRole="tablist">
          {week.map((d) => {
            const on = d.dow === activeDay
            return (
              <Pressable
                key={d.dow}
                onPress={() => setActiveDay(d.dow)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${d.label}, ${d.date.format('D MMMM')}`}
                style={[styles.day, { backgroundColor: on ? colors.primary : 'rgba(255,255,255,0.6)', borderColor: on ? colors.primary : 'rgba(255,255,255,0.9)' }]}
              >
                <Text style={[styles.dayLabel, { color: on ? '#FFFFFF' : colors.text }]}>{d.label}</Text>
                <Text style={[styles.dayNum, { color: on ? '#FFFFFF' : colors.text }]}>{d.date.format('D')}</Text>
              </Pressable>
            )
          })}
        </View>

        {dayLessons.length === 0 ? (
          <EmptyState title={uiText("Уроков нет")} hint={uiText("На этот день расписание не составлено.")} />
        ) : (
          <View style={{ gap: 10 }}>
            {dayLessons.map((l, i) => {
              const isToday = activeDay === todayDow
              const live = isToday && nowMin >= toMin(l.startTime) && nowMin < toMin(l.endTime)
              const past = isToday && nowMin >= toMin(l.endTime)
              return (
                <View key={l.id} style={styles.lessonWrap}>
                  <View style={styles.times}>
                    <Text style={styles.t1}>{l.startTime}</Text>
                    <Text style={styles.t2}>{l.endTime}</Text>
                  </View>
                  <View style={[styles.lesson, live && { backgroundColor: '#FFFFFF' }]}>
                    <View style={[styles.bar, { backgroundColor: BAR[i % BAR.length] }]} />
                    <Text style={styles.subject} numberOfLines={1}>
                      {l.activity}
                    </Text>
                    {live ? <Text style={[styles.tag, { color: '#D9532E' }]}>{uiText("СЕЙЧАС")}</Text> : past ? <Text style={[styles.tag, { color: '#7A8C8E' }]}>{uiText("прошёл")}</Text> : null}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 14 },
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
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 64, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayLabel: { fontSize: 12, fontWeight: '700', opacity: 0.8 },
  dayNum: { fontSize: 19, fontWeight: '800' },
  lessonWrap: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  times: { width: 46, alignItems: 'flex-end', justifyContent: 'center' },
  lesson: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  t1: { fontSize: 14, fontWeight: '800', color: colors.text },
  t2: { fontSize: 12, fontWeight: '600', color: '#7A8C8E' },
  bar: { width: 6, alignSelf: 'stretch', minHeight: 32, borderRadius: 3 },
  subject: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  tag: { fontSize: 11, fontWeight: '800' },
}))
