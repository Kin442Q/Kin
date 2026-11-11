import { localizeCopy, uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import dayjs from 'dayjs'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import IconTile from '../components/IconTile'
import { colors, radius } from '../theme/colors'
import { subjectIcon, tint } from '../lib/subjectIcon'
import { studentApi, type StudentLesson } from '../api/student'
import { notifyError } from '../lib/notify'
import { themedStyles } from '../theme/themedStyles'

const WEEKDAYS = localizeCopy(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'])
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Расписание ученика на неделю: выбор дня и уроки с временем, кабинетом и отметкой «идёт сейчас». */
export default function StudentScheduleScreen() {
  const todayDow = dayjs().day() === 0 ? 7 : dayjs().day() // 1..7, Пн..Вс

  const [lessons, setLessons] = useState<StudentLesson[]>([])
  const [activeDay, setActiveDay] = useState<number>(todayDow > 6 ? 1 : todayDow)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setLessons(await studentApi.schedule())
    } catch (e) {
      notifyError(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Даты текущей недели: понедельник … суббота
  const week = useMemo(() => {
    const monday = dayjs().startOf('day').subtract(todayDow - 1, 'day')
    return WEEKDAYS.map((label, i) => ({ dow: i + 1, label, date: monday.add(i, 'day') }))
  }, [todayDow, uiLanguage()])

  const dayLessons = lessons
    .filter((l) => l.dayOfWeek === activeDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const nowMin = dayjs().hour() * 60 + dayjs().minute()

  return (
    <Screen>
      <StackHeader title={uiText("Расписание")} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
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
                  style={[styles.day, { backgroundColor: on ? colors.primary : colors.surfaceStrong }]}
                >
                  <Text style={[styles.dayLabel, { color: on ? colors.onPrimary : colors.text }]}>{d.label}</Text>
                  <Text style={[styles.dayNum, { color: on ? colors.onPrimary : colors.text }]}>{d.date.format('D')}</Text>
                </Pressable>
              )
            })}
          </View>

          {dayLessons.length === 0 ? (
            <EmptyState title={uiText("Уроков нет")} hint={uiText("На этот день расписание не составлено.")} />
          ) : (
            <View style={{ gap: 8 }}>
              {dayLessons.map((l) => {
                const isToday = activeDay === todayDow
                const live = isToday && nowMin >= toMin(l.startTime) && nowMin < toMin(l.endTime)
                const past = isToday && nowMin >= toMin(l.endTime)
                const name = l.subject?.name ?? l.activity
                return (
                  <View key={l.id} style={[styles.lesson, live && styles.lessonLive, past && { opacity: 0.55 }]}>
                    <IconTile
                      icon={subjectIcon(name)}
                      bg={tint(l.subject?.color, 0.18, colors.primarySoft)}
                      fg={l.subject?.color ?? colors.primaryDeep}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subject} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={styles.meta}>
                        {l.startTime}–{l.endTime}
                        {l.room ? uiText("· каб. {0}", l.room) : ''}
                      </Text>
                    </View>
                    {live ? <Text style={styles.liveTag}>{uiText("идёт сейчас")}</Text> : past ? <Text style={styles.pastTag}>{uiText("прошёл")}</Text> : null}
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = themedStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 14, paddingBottom: 32 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayLabel: { fontSize: 12, fontWeight: '600' },
  dayNum: { fontSize: 18, fontWeight: '800' },
  lesson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  lessonLive: { backgroundColor: colors.surfaceStrong, borderColor: colors.primary },
  subject: { fontSize: 15, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textMid, marginTop: 2 },
  liveTag: { fontSize: 11, fontWeight: '800', color: colors.roseDeep, letterSpacing: 0.3 },
  pastTag: { fontSize: 11, color: colors.muted },
}))
