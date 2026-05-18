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
import { Calendar } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors, radius } from '../theme/colors'
import {
  parentApi,
  type KidDto,
  type ScheduleItemDto,
} from '../api/parent'

const DAYS_FULL: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
}
const DAYS_SHORT: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
}

export default function ParentScheduleScreen() {
  const todayDow = ((new Date().getDay() + 6) % 7) + 1
  const [kids, setKids] = useState<KidDto[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItemDto[]>([])
  const [activeDay, setActiveDay] = useState<number>(todayDow)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadKids = useCallback(async () => {
    try {
      const list = await parentApi.myKids()
      setKids(list)
      if (list.length && !activeKidId) setActiveKidId(list[0].id)
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || String(e))
    }
  }, [activeKidId])

  const loadSchedule = useCallback(async () => {
    if (!activeKidId) return
    try {
      const s = await parentApi.schedule(activeKidId)
      setSchedule(s)
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

  const items = useMemo(
    () => schedule.filter((s) => s.dayOfWeek === activeDay),
    [schedule, activeDay],
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

  const activeKid = kids.find((k) => k.id === activeKidId)

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
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
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.title}>Расписание</Text>
            {activeKid && (
              <Text style={styles.subtitle}>
                {activeKid.firstName} · группа «{activeKid.group?.name}»
              </Text>
            )}

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
                          backgroundColor: on
                            ? colors.primary
                            : colors.surfaceAlt,
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

            <View style={styles.dayRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const on = d === activeDay
                const isToday = d === todayDow
                return (
                  <Pressable
                    key={d}
                    onPress={() => setActiveDay(d)}
                    style={[
                      styles.dayPill,
                      {
                        backgroundColor: on
                          ? colors.primaryDeep
                          : colors.surface,
                        borderColor: on
                          ? colors.primaryDeep
                          : colors.borderSoft,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? '#fff' : colors.textMid,
                        fontWeight: '700',
                        fontSize: 11,
                      }}
                    >
                      {DAYS_SHORT[d]}
                    </Text>
                    {isToday && (
                      <View
                        style={[
                          styles.todayDot,
                          {
                            backgroundColor: on ? '#fff' : colors.primary,
                          },
                        ]}
                      />
                    )}
                  </Pressable>
                )
              })}
            </View>

            <Text style={styles.dayTitle}>{DAYS_FULL[activeDay]}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Card padding={14}>
            <View style={styles.itemRow}>
              <View style={styles.timeCol}>
                <Text style={styles.time}>{item.startTime}</Text>
                <Text style={styles.timeEnd}>{item.endTime}</Text>
              </View>
              <View style={styles.divider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activity}>{item.activity}</Text>
                <Text style={styles.activitySub}>
                  {durationLabel(item.startTime, item.endTime)}
                </Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Calendar size={36} color={colors.muted} />
            <Text style={styles.emptyText}>
              На {DAYS_FULL[activeDay].toLowerCase()} занятий нет.
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) return ''
  if (mins < 60) return `${mins} минут`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  kidTabs: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  kidChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  dayRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dayPill: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMid,
    marginTop: 16,
    marginBottom: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  timeCol: { width: 56, alignItems: 'center' },
  time: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDeep,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  timeEnd: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderSoft,
    marginHorizontal: 14,
  },
  activity: { fontSize: 15, fontWeight: '700', color: colors.text },
  activitySub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
})
