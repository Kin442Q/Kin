import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import {
  BookOpen,
  Gamepad2,
  GraduationCap,
  Library,
  ListChecks,
  Target,
  type LucideIcon,
} from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { hasFeature, type FeatureKey } from '../lib/features'
import {
  studentApi,
  type StudentHomework,
  type StudentLesson,
  type StudentProfile,
} from '../api/student'

interface Shortcut {
  route: string
  label: string
  icon: LucideIcon
  bg: string
  fg: string
  feature: FeatureKey
}

const SHORTCUTS: Shortcut[] = [
  { route: 'StudentLibrary', label: 'Библиотека', icon: Library, bg: colors.blueSoft, fg: colors.blueDeep, feature: 'library' },
  { route: 'StudentQuizzes', label: 'Квизы', icon: ListChecks, bg: colors.primarySoft, fg: colors.primaryDeep, feature: 'quiz' },
  { route: 'StudentExam', label: 'К экзаменам', icon: Target, bg: colors.yellowSoft, fg: colors.yellowDeep, feature: 'exam_prep' },
  { route: 'StudentGames', label: 'Игры', icon: Gamepad2, bg: colors.lilacSoft, fg: colors.lilacDeep, feature: 'games' },
]

const greeting = () => {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

/** Главная ученика: класс, уроки на сегодня, ближайшие задания и быстрые переходы. */
export default function StudentHomeScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const showHomework = hasFeature(user, 'homework')
  const showSchedule = hasFeature(user, 'schedule')

  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [homework, setHomework] = useState<StudentHomework[]>([])
  const [lessons, setLessons] = useState<StudentLesson[]>([])
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
      const [hw, sch] = await Promise.all([
        showHomework
          ? studentApi
              .homework({ from: dayjs().format('YYYY-MM-DD') })
              .catch(() => [] as StudentHomework[])
          : Promise.resolve([] as StudentHomework[]),
        showSchedule
          ? studentApi.schedule().catch(() => [] as StudentLesson[])
          : Promise.resolve([] as StudentLesson[]),
      ])
      setHomework(hw)
      setLessons(sch)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showHomework, showSchedule])

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

  // dayjs: 0 = воскресенье; в расписании 1..7 = Пн..Вс.
  const todayDow = dayjs().day() === 0 ? 7 : dayjs().day()
  const todayLessons = lessons
    .filter((l) => l.dayOfWeek === todayDow)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const pending = homework
    .filter((h) => !h.submission || h.submission.status === 'SUBMITTED')
    .slice(0, 3)
  const shortcuts = SHORTCUTS.filter((s) => hasFeature(user, s.feature))

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
        <Text style={styles.greeting}>{greeting()},</Text>
        <Text style={styles.name}>{profile?.firstName ?? user?.fullName}</Text>

        {error && !profile ? (
          <EmptyState title="Не получилось загрузить" hint={error} />
        ) : null}

        {profile && (
          <Card padding={16} style={styles.rowCard}>
            <Avatar name={`${profile.firstName} ${profile.lastName}`} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {profile.lastName} {profile.firstName}
              </Text>
              <Text style={styles.meta}>Класс {profile.group.name}</Text>
              {profile.homeroomTeacher && (
                <Text style={styles.meta}>
                  Классный руководитель: {profile.homeroomTeacher.fullName}
                </Text>
              )}
            </View>
          </Card>
        )}

        {shortcuts.length > 0 && (
          <View style={styles.shortcuts}>
            {shortcuts.map((s) => {
              const Icon = s.icon
              return (
                <Pressable
                  key={s.route}
                  onPress={() => navigation.navigate(s.route)}
                  style={({ pressed }) => [
                    styles.shortcut,
                    { backgroundColor: s.bg },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Icon size={22} color={s.fg} />
                  <Text style={[styles.shortcutText, { color: s.fg }]}>{s.label}</Text>
                </Pressable>
              )
            })}
          </View>
        )}

        {showSchedule && (
          <>
            <Text style={styles.section}>Сегодня</Text>
            <Card padding={14}>
              {todayLessons.length === 0 ? (
                <Text style={styles.muted}>Сегодня уроков нет</Text>
              ) : (
                todayLessons.map((l, i) => (
                  <View
                    key={l.id}
                    style={[styles.lesson, i > 0 && styles.lessonBorder]}
                  >
                    <Text style={styles.time}>
                      {l.startTime}–{l.endTime}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lessonTitle}>
                        {l.subject?.name ?? l.activity}
                      </Text>
                      {l.room ? <Text style={styles.meta}>каб. {l.room}</Text> : null}
                    </View>
                    {l.subject && (
                      <View style={[styles.dot, { backgroundColor: l.subject.color }]} />
                    )}
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        {showHomework && (
          <>
            <Text style={styles.section}>Что нужно сделать</Text>
            {pending.length === 0 ? (
              <Card padding={14}>
                <Text style={styles.muted}>Все задания выполнены — отлично! 🎉</Text>
              </Card>
            ) : (
              <View style={{ gap: 8 }}>
                {pending.map((h) => (
                  <Card key={h.id} padding={14} style={styles.rowCard}>
                    <BookOpen size={18} color={h.subject.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {h.title}
                      </Text>
                      <Text style={styles.meta}>
                        {h.subject.name} · до {dayjs(h.dueDate).format('D MMM')}
                      </Text>
                    </View>
                  </Card>
                ))}
                <Pressable onPress={() => navigation.navigate('StudentHomework')}>
                  <Text style={styles.link}>Все задания →</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {hasFeature(user, 'grades') && (
          <Pressable onPress={() => navigation.navigate('StudentGrades')}>
            <Card padding={14} style={styles.rowCard}>
              <GraduationCap size={20} color={colors.primaryDeep} />
              <Text style={[styles.cardTitle, { flex: 1 }]}>Мои оценки</Text>
              <Text style={styles.link}>→</Text>
            </Card>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20, gap: 12, paddingBottom: 32 },
  greeting: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  muted: { fontSize: 13, color: colors.muted },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMid,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shortcutText: { fontSize: 14, fontWeight: '800' },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  lessonBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  time: { width: 92, fontSize: 13, fontWeight: '700', color: colors.textMid },
  lessonTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primaryDeep },
})
