import { uiText } from '../i18n/uiText'
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
import { Check, CircleHelp, Flame, Puzzle, Star, Trophy, TrendingUp } from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import GradientView from '../components/GradientView'
import IconTile from '../components/IconTile'
import { ScreenHeading } from '../components/ui'
import { colors, shadow } from '../theme/colors'
import { averageColor } from '../lib/gradeStyle'
import { useAuthStore } from '../store/authStore'
import { hasFeature } from '../lib/features'
import { plural } from '../lib/classes'
import { MAX_SCORE } from '../lib/games'
import { streakLabel, xpLabel } from '../lib/progress'
import { subjectIcon, tint } from '../lib/subjectIcon'
import { quizApi, type QuizSummary } from '../api/learning'
import {
  studentApi,
  type StudentGrades,
  type StudentHomework,
  type StudentLesson,
  type StudentProfile,
  type StudentProgress,
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
  if (diff <= 0) return { text: uiText("сегодня"), soon: true }
  if (diff === 1) return { text: uiText("завтра"), soon: true }
  return { text: d.format('dd'), soon: false }
}

/** Главная ученика: класс, серия и XP, уроки на сегодня, что нужно сделать и быстрые переходы. */
export default function StudentHomeScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const showHomework = hasFeature(user, 'homework')
  const showSchedule = hasFeature(user, 'schedule')

  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [homework, setHomework] = useState<StudentHomework[]>([])
  const [lessons, setLessons] = useState<StudentLesson[]>([])
  const [grades, setGrades] = useState<StudentGrades | null>(null)
  const [progress, setProgress] = useState<StudentProgress | null>(null)
  const [weeklyQuiz, setWeeklyQuiz] = useState<QuizSummary | null>(null)
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
      const [hw, sch, gr, pr, quizzes] = await Promise.all([
        showHomework
          ? studentApi.homework({ from: dayjs().format('YYYY-MM-DD') }).catch(() => [] as StudentHomework[])
          : Promise.resolve([] as StudentHomework[]),
        showSchedule
          ? studentApi.schedule().catch(() => [] as StudentLesson[])
          : Promise.resolve([] as StudentLesson[]),
        hasFeature(user, 'grades') ? studentApi.grades().catch(() => null) : Promise.resolve(null),
        // серия, XP и уровень: необязательны, их сбой главную не роняет
        studentApi.progress().catch(() => null),
        hasFeature(user, 'quiz') ? quizApi.list().catch(() => [] as QuizSummary[]) : Promise.resolve([] as QuizSummary[]),
      ])
      setHomework(hw)
      setLessons(sch)
      setGrades(gr)
      setProgress(pr)
      setWeeklyQuiz(quizzes.find((q) => !q.myBest && q.questionsCount > 0) ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message || uiText("Не удалось загрузить данные"))
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
      notifyError(e, uiText("Не получилось сохранить"))
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
    ? `${profile.group.name}${profile.homeroomTeacher ? uiText("· Кл. руководитель:") + profile.homeroomTeacher.fullName : ''}`
    : undefined
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() : '?'

  const gamesCount = Object.keys(MAX_SCORE).length
  const tiles: { label: string; value: string; valueColor: string; icon: typeof Star; bg: string; fg: string; onPress: () => void }[] = []
  if (hasFeature(user, 'grades'))
    tiles.push({
      label: uiText("Мои оценки"),
      value: avg != null ? avg.toFixed(1) : '—',
      valueColor: colors.text,
      icon: TrendingUp,
      bg: 'rgba(79,178,134,0.2)',
      fg: avg != null ? averageColor(avg) : '#2E8B63',
      onPress: () => navigation.navigate('StudentGrades'),
    })
  if (hasFeature(user, 'quiz'))
    tiles.push({
      label: uiText("Квиз недели"),
      value: weeklyQuiz ? uiText("{0} вопр.", weeklyQuiz.questionsCount) : '—',
      valueColor: colors.text,
      icon: CircleHelp,
      bg: colors.roseSoft,
      fg: colors.roseDeep,
      onPress: () => navigation.navigate('StudentQuizzes'),
    })
  if (hasFeature(user, 'games'))
    tiles.push({
      label: uiText("Для мозга"),
      value: `${gamesCount} ${plural(gamesCount, [uiText("игра"), uiText("игры"), uiText("игр")])}`,
      valueColor: colors.text,
      icon: Puzzle,
      bg: colors.lilacSoft,
      fg: colors.lilacDeep,
      onPress: () => navigation.navigate('StudentGames'),
    })

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
          title={uiText("Салом, {0}!", first)}
          size={26}
          right={
            <View style={styles.avatar} accessibilityLabel={uiText("Профиль: {0}", first)}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          }
        />

        {error && !profile ? <EmptyState title={uiText("Не получилось загрузить")} hint={error} /> : null}

        {progress && (
          <View style={styles.pills}>
            <View style={[styles.pill, { backgroundColor: colors.roseSoft }]}>
              <Flame size={15} color={colors.roseDeep} />
              <Text style={styles.pillText}>{streakLabel(progress.streakDays)}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.yellowSoft }]}>
              <Star size={15} color={colors.yellow} fill={colors.yellow} />
              <Text style={styles.pillText}>{xpLabel(progress.xp)}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
              <Trophy size={15} color={colors.primary} />
              <Text style={styles.pillText}>{uiText("Уровень") + " "}{progress.level}</Text>
            </View>
          </View>
        )}

        {showSchedule && (
          <Card padding={16}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{uiText("Сегодня")}</Text>
              <Pressable onPress={() => navigation.navigate('StudentSchedule')} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.cardLink}>{uiText("Расписание →")}</Text>
              </Pressable>
            </View>
            {todayLessons.length === 0 ? (
              <Text style={styles.muted}>{uiText("Сегодня уроков нет")}</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {todayLessons.map((l) => {
                  const now = nowMin >= minutes(l.startTime) && nowMin < minutes(l.endTime)
                  const name = l.subject?.name ?? l.activity
                  const body = (
                    <>
                      <IconTile
                        icon={subjectIcon(name)}
                        bg={now ? 'rgba(255,255,255,0.22)' : tint(l.subject?.color, 0.2, colors.primarySoft)}
                        fg={now ? '#FFFFFF' : (l.subject?.color ?? colors.primaryDeep)}
                        size={32}
                      />
                      <Text style={[styles.lessonTime, now && { color: '#BDEBE8' }]}>{now ? uiText("сейчас") : l.startTime}</Text>
                      <Text style={[styles.lessonName, now && { color: '#FFFFFF' }]} numberOfLines={1}>
                        {name}
                      </Text>
                    </>
                  )
                  return now ? (
                    <GradientView key={l.id} from="#0D7A7C" to="#075B5D" style={[styles.lessonCard, shadow.md]}>
                      {body}
                    </GradientView>
                  ) : (
                    <View key={l.id} style={[styles.lessonCard, styles.lessonCardPlain]}>
                      {body}
                    </View>
                  )
                })}
              </ScrollView>
            )}
          </Card>
        )}

        {showHomework && (
          <Card padding={16}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{uiText("Что нужно сделать")}</Text>
              {homework.length > 0 ? (
                <Text style={styles.cardCount}>
                  {waiting} {" " + uiText("из") + " "}{homework.length}
                </Text>
              ) : null}
            </View>
            {todo.length === 0 ? (
              <Text style={styles.muted}>{uiText("Все задания выполнены — отлично!")}</Text>
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
                      <Text
                        style={[styles.todoText, done && { color: colors.muted, textDecorationLine: 'line-through' }]}
                        numberOfLines={2}
                      >
                        {h.subject.name}: {h.title}
                      </Text>
                      {due.soon && !done ? (
                        <View style={styles.duePill}>
                          <Text style={styles.duePillText}>{due.text}</Text>
                        </View>
                      ) : (
                        <Text style={styles.due}>{due.text}</Text>
                      )}
                    </Pressable>
                  )
                })}
              </View>
            )}
          </Card>
        )}

        {tiles.length > 0 && (
          <View style={styles.tiles}>
            {tiles.map((t) => (
              <Pressable key={t.label} onPress={t.onPress} accessibilityRole="button" style={{ flex: 1 }}>
                <Card padding={12} style={styles.tile}>
                  <IconTile icon={t.icon} bg={t.bg} fg={t.fg} size={34} />
                  <View>
                    <Text style={[styles.tileValue, { color: t.valueColor }]} numberOfLines={1}>
                      {t.value}
                    </Text>
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {t.label}
                    </Text>
                  </View>
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#0B3A3B' },
  muted: { fontSize: 14, color: colors.textMid },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.text },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  cardCount: { fontSize: 13, fontWeight: '700', color: colors.primary },
  lessonCard: { width: 108, padding: 12, borderRadius: 20, gap: 4 },
  lessonCardPlain: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.glassBorder },
  lessonTime: { fontSize: 12, color: colors.textMid, marginTop: 6 },
  lessonName: { fontSize: 14, fontWeight: '800', color: colors.text },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  todoText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  due: { fontSize: 12, color: colors.textMid, minWidth: 24, textAlign: 'right' },
  duePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.roseSoft },
  duePillText: { fontSize: 12, fontWeight: '700', color: colors.roseDeep },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { gap: 18, borderRadius: 22 },
  tileValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  tileLabel: { fontSize: 12, fontWeight: '600', color: colors.textMid, marginTop: 2 },
}))
