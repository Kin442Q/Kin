import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import dayjs from 'dayjs'
import { ChevronDown } from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import EmptyState from '../components/EmptyState'
import { ScreenHeading } from '../components/ui'
import { colors, radius } from '../theme/colors'
import { parentApi, type KidDto, type ScheduleItemDto } from '../api/parent'

/** Цветная полоса урока по порядку в дне (палитра макета). */
const BAR = ['#0D7A7C', '#FF8A65', '#9EDDD9', '#F6C46A', '#0D7A7C', '#FF8A65', '#9EDDD9', '#F6C46A']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

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
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
      setLoading(false)
    }
  }, [activeKidId])

  const loadSchedule = useCallback(async () => {
    if (!activeKidId) return
    try {
      setSchedule(await parentApi.schedule(activeKidId))
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
    if (activeKidId) loadSchedule()
  }, [activeKidId, loadSchedule])

  // Даты текущей недели: понедельник … суббота
  const week = useMemo(() => {
    const monday = dayjs().startOf('day').subtract(todayDow - 1, 'day')
    return WEEKDAYS.map((label, i) => ({ dow: i + 1, label, date: monday.add(i, 'day') }))
  }, [todayDow])

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
              loadSchedule()
            }}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeading
          eyebrow={`${kid.firstName}${kid.group?.name ? ' · ' + kid.group.name : ''}`}
          title="Расписание"
          right={
            kids.length > 1 ? (
              <Pressable onPress={cycleKid} accessibilityRole="button" accessibilityLabel="Сменить ребёнка" style={styles.switch}>
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
                style={[styles.day, { backgroundColor: on ? colors.primary : 'rgba(255,255,255,0.8)' }]}
              >
                <Text style={[styles.dayLabel, { color: on ? '#FFFFFF' : colors.text }]}>{d.label}</Text>
                <Text style={[styles.dayNum, { color: on ? '#FFFFFF' : colors.text }]}>{d.date.format('D')}</Text>
              </Pressable>
            )
          })}
        </View>

        {dayLessons.length === 0 ? (
          <EmptyState title="Уроков нет" hint="На этот день расписание не составлено." />
        ) : (
          <View style={{ gap: 8 }}>
            {dayLessons.map((l, i) => {
              const live = activeDay === todayDow && nowMin >= toMin(l.startTime) && nowMin < toMin(l.endTime)
              return (
                <View key={l.id} style={[styles.lesson, live && { backgroundColor: '#FFFFFF' }]}>
                  <View style={{ width: 54 }}>
                    <Text style={styles.t1}>{l.startTime}</Text>
                    <Text style={styles.t2}>{l.endTime}</Text>
                  </View>
                  <View style={[styles.bar, { backgroundColor: BAR[i % BAR.length] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subject} numberOfLines={1}>
                      {l.activity}
                    </Text>
                    {live && <Text style={styles.liveTag}>идёт сейчас</Text>}
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 14 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  switchText: { fontSize: 13, fontWeight: '700', color: colors.text },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayLabel: { fontSize: 12, fontWeight: '600' },
  dayNum: { fontSize: 18, fontWeight: '800' },
  lesson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  t1: { fontSize: 14, fontWeight: '700', color: colors.text },
  t2: { fontSize: 12, color: colors.textMid },
  bar: { width: 4, height: 36, borderRadius: 4 },
  subject: { fontSize: 15, fontWeight: '700', color: colors.text },
  liveTag: { fontSize: 12, color: colors.primaryDeep, fontWeight: '600', marginTop: 2 },
})
