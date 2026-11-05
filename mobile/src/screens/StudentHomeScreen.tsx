import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import { Check } from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { CardTitle, ScreenHeading } from '../components/ui'
import { colors } from '../theme/colors'
import { averageColor } from '../lib/gradeStyle'
import { useAuthStore } from '../store/authStore'
import { hasFeature } from '../lib/features'
import {
  studentApi,
  type StudentGrades,
  type StudentHomework,
  type StudentLesson,
  type StudentProfile,
} from '../api/student'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** «сегодня», «завтра» или день недели — срок задания. */
function dueShort(due: string): { text: string; soon: boolean } {
  const d = dayjs(due).startOf('day')
  const diff = d.diff(dayjs().startOf('day'), 'day')
  if (diff <= 0) return { text: 'сегодня', soon: true }
  if (diff === 1) return { text: 'завтра', soon: true }
  return { text: d.format('dd'), soon: false }
}

/** Главная ученика: класс, уроки на сегодня, что нужно сделать и быстрые переходы. */
export default function StudentHomeScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const showHomework = hasFeature(user, 'homework')
  const showSchedule = hasFeature(user, 'schedule')

  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [homework, setHomework] = useState<StudentHomework[]>([])
  const [lessons, setLessons] = useState<StudentLesson[]>([])
  const [grades, setGrades] = useState<StudentGrades | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      // Профиль обязателен; остальное — по включённым разделам, и сбой одного
      // не должен ронять главную.
      const me = await studentApi.me()
      setProfile(me)
      const [hw, sch, gr] = await Promise.all([
        showHomework
          ? studentApi.homework({ from: dayjs().format('YYYY-MM-DD') }).catch(() => [] as StudentHomework[])
          : Promise.resolve([] as StudentHomework[]),
        showSchedule
          ? studentApi.schedule().catch(() => [] as StudentLesson[])
          : Promise.resolve([] as StudentLesson[]),
        hasFeature(user, 'grades') ? studentApi.grades().catch(() => null) : Promise.resolve(null),
      ])
      setHomework(hw)
      setLessons(sch)
      setGrades(gr)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showHomework, showSchedule, user])

  useEffect(() => {
    load()
  }, [load])

  /** Галочка «сделал»: отмечает задание выполненным ребёнком (вердикт учителя не затирается). */
  const toggle = async (h: StudentHomework) => {
    const done = !!h.submission
    try {
      const r = await studentApi.setSubmitted(h.id, !done)
      setHomework((list) =>
        list.map((x) =>
          x.id === h.id
            ? { ...x, submission: r.status ? { status: r.status, comment: null, updatedAt: new Date().toISOString() } : null }
            : x,
        ),
      )
    } catch (e: any) {
      notifyError(e, 'Не получилось сохранить')
    }
  }

  if (loading) {
    return (
      <Screen variant="home">
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  // dayjs: 0 = воскресенье; в расписании 1..7 = Пн..Вс.
  const todayDow = dayjs().day() === 0 ? 7 : dayjs().day()
  const todayLessons = lessons
    .filter((l) => l.dayOfWeek === todayDow)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const nowMin = dayjs().hour() * 60 + dayjs().minute()
  const todo = homework.slice(0, 4)
  const waiting = homework.filter((h) => !h.submission).length
  const all = grades?.items ?? []
  const avg = all.length ? all.reduce((s, g) => s + g.value, 0) / all.length : null
  const first = profile?.firstName ?? user?.fullName?.split(' ')[0] ?? ''

  const eyebrow = profile
    ? `${profile.group.name}${profile.homeroomTeacher ? ' · Кл. руководитель: ' + profile.homeroomTeacher.fullName : ''}`
    : undefined
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() : '?'

  const tiles: { label: string; value: string; color: string; onPress: () => void }[] = []
  if (hasFeature(user, 'grades'))
    tiles.push({
      label: 'Мои оценки',
      value: avg != null ? avg.toFixed(1) : '—',
      color: avg != null ? averageColor(avg) : colors.primary,
      onPress: () => navigation.navigate('StudentGrades'),
    })
  if (hasFeature(user, 'quiz'))
    tiles.push({ label: 'Квиз недели', value: '?', color: colors.coral, onPress: () => navigation.navigate('StudentQuizzes') })
  if (hasFeature(user, 'games'))
    tiles.push({ label: 'Игры для мозга', value: '✦', color: colors.primary, onPress: () => navigation.navigate('StudentGames') })

  return (
    <Screen variant="home">
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
          eyebrow={eyebrow}
          title={`Салом, ${first}!`}
          size={24}
          right={
            <View style={styles.avatar} accessibilityLabel={`Профиль: ${first}`}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          }
        />

        {error && !profile ? <EmptyState title="Не получилось загрузить" hint={error} /> : null}

        {showSchedule && (
          <Card padding={16}>
            <CardTitle title="Сегодня" />
            {todayLessons.length === 0 ? (
              <Text style={styles.muted}>Сегодня уроков нет</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {todayLessons.map((l) => {
                  const start = minutes(l.startTime)
                  const end = minutes(l.endTime)
                  const now = nowMin >= start && nowMin < end
                  const past = nowMin >= end
                  return (
                    <View
                      key={l.id}
                      style={[
                        styles.lessonChip,
                        now ? { backgroundColor: colors.primary } : past ? styles.lessonPast : styles.lessonNext,
                      ]}
                    >
                      <Text style={[styles.lessonTime, now && { color: '#BDEBE8' }]}>{now ? 'сейчас' : l.startTime}</Text>
                      <Text style={[styles.lessonName, now && { color: '#FFFFFF' }]} numberOfLines={1}>
                        {l.subject?.name ?? l.activity}
                      </Text>
                    </View>
                  )
                })}
              </ScrollView>
            )}
          </Card>
        )}

        {showHomework && (
          <Card padding={16}>
            <CardTitle
              title="Что нужно сделать"
              right={waiting ? `${waiting} ${waiting === 1 ? 'задание' : waiting < 5 ? 'задания' : 'заданий'}` : undefined}
              rightTone="warn"
            />
            {todo.length === 0 ? (
              <Text style={styles.muted}>Все задания выполнены — отлично!</Text>
            ) : (
              <View style={{ gap: 4 }}>
                {todo.map((h) => {
                  const done = !!h.submission
                  const due = dueShort(h.dueDate)
                  return (
                    <Pressable
                      key={h.id}
                      onPress={() => toggle(h)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      accessibilityLabel={`${h.subject.name}: ${h.title}`}
                      style={styles.todoRow}
                    >
                      <View style={[styles.check, done && styles.checkOn]}>
                        {done && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                      <Text style={[styles.todoText, done && { opacity: 0.55 }]} numberOfLines={2}>
                        {h.subject.name}: {h.title}
                      </Text>
                      <Text style={[styles.due, due.soon && !done && { color: colors.roseDeep, fontWeight: '700' }]}>{due.text}</Text>
                    </Pressable>
                  )
                })}
                <Pressable onPress={() => navigation.navigate('StudentHomework')} accessibilityRole="link">
                  <Text style={styles.link}>Все задания →</Text>
                </Pressable>
              </View>
            )}
          </Card>
        )}

        {tiles.length > 0 && (
          <View style={styles.tiles}>
            {tiles.map((t) => (
              <Pressable key={t.label} onPress={t.onPress} accessibilityRole="button" style={{ flex: 1 }}>
                <Card padding={14} elevation="none" style={{ gap: 6, alignItems: 'flex-start' }}>
                  <Text style={[styles.tileValue, { color: t.color }]}>{t.value}</Text>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.textMid },
  lessonChip: { width: 104, padding: 12, borderRadius: 16, gap: 2 },
  lessonPast: { backgroundColor: colors.surfaceAlt, opacity: 0.6 },
  lessonNext: { backgroundColor: colors.surfaceStrong },
  lessonTime: { fontSize: 12, color: colors.textMid },
  lessonName: { fontSize: 14, fontWeight: '700', color: colors.text },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary },
  todoText: { flex: 1, fontSize: 14, color: colors.text },
  due: { fontSize: 12, color: colors.textMid },
  link: { fontSize: 13, fontWeight: '700', color: colors.primaryDeep, paddingVertical: 6 },
  tiles: { flexDirection: 'row', gap: 8 },
  tileValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  tileLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
}))
