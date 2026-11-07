import { useCallback, useState } from 'react'
import {
  Pressable,
  ScrollView,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import {
  ChevronRight,
  Clock,
  Gamepad2,
  Library,
  ListChecks,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { hasFeature, type FeatureKey } from '../lib/features'
import { quizApi, type QuizSummary } from '../api/learning'
import { maxQuizXp, minutesLabel } from '../lib/progress'
import { plural } from '../lib/classes'

import { themedStyles, themedValue } from '../theme/themedStyles'
interface Section {
  route: string
  title: string
  text: string
  icon: LucideIcon
  bg: string
  fg: string
  feature: FeatureKey
}

const SECTIONS = themedValue<Section[]>(() => ([
  { route: 'StudentLibrary', title: 'Библиотека', text: 'Книги, статьи, видео и ссылки от учителей', icon: Library, bg: colors.blueSoft, fg: colors.blueDeep, feature: 'library' },
  { route: 'StudentQuizzes', title: 'Квизы', text: 'Тесты с мгновенной проверкой и разбором ответов', icon: ListChecks, bg: colors.primarySoft, fg: colors.primaryDeep, feature: 'quiz' },
  { route: 'StudentExam', title: 'Подготовка к экзаменам', text: 'Направления подготовки и твой прогресс', icon: Target, bg: colors.yellowSoft, fg: colors.yellowDeep, feature: 'exam_prep' },
  { route: 'StudentGames', title: 'Игры для мозга', text: 'Память, счёт и внимание. Рейтинг класса', icon: Gamepad2, bg: colors.lilacSoft, fg: colors.lilacDeep, feature: 'games' },
]))

/** Вкладка «Учёба»: библиотека, квизы, подготовка к экзаменам и игры (что включено у школы). */
export default function StudentLearnScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const sections = SECTIONS().filter((s) => hasFeature(user, s.feature))

  // «Квиз недели»: самый свежий квиз, который ученик ещё не проходил
  const [weekly, setWeekly] = useState<QuizSummary | null>(null)
  const quizOn = hasFeature(user, 'quiz')
  useFocusEffect(
    useCallback(() => {
      if (!quizOn) return
      let alive = true
      quizApi
        .list()
        .then((list) => alive && setWeekly(list.find((q) => !q.myBest && q.questionsCount > 0) ?? null))
        .catch(() => alive && setWeekly(null))
      return () => {
        alive = false
      }
    }, [quizOn]),
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Учёба</Text>
        {weekly && (
          <Pressable
            onPress={() => navigation.navigate('StudentQuizPlay', { id: weekly.id })}
            accessibilityRole="button"
            accessibilityLabel={`Квиз недели: ${weekly.title}`}
            style={({ pressed }) => [styles.weekly, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.weeklyTag}>
              <Sparkles size={14} color="#FFFFFF" />
              <Text style={styles.weeklyTagText}>КВИЗ НЕДЕЛИ · +{maxQuizXp(weekly.questionsCount)} XP</Text>
            </View>
            <Text style={styles.weeklyTitle} numberOfLines={2}>
              {weekly.title}
            </Text>
            <View style={styles.weeklyMeta}>
              <Text style={styles.weeklyMetaText}>
                {weekly.questionsCount} {plural(weekly.questionsCount, ['вопрос', 'вопроса', 'вопросов'])}
              </Text>
              {minutesLabel(weekly.timeLimitSec) ? (
                <View style={styles.weeklyTime}>
                  <Clock size={13} color="#DDF1F0" />
                  <Text style={styles.weeklyMetaText}>{minutesLabel(weekly.timeLimitSec)}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <Pressable key={s.route} onPress={() => navigation.navigate(s.route)}>
              <Card padding={16} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: s.bg }]}>
                  <Icon size={24} color={s.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.title}</Text>
                  <Text style={styles.rowText}>{s.text}</Text>
                </View>
                <ChevronRight size={20} color={colors.muted} />
              </Card>
            </Pressable>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  weekly: { padding: 18, borderRadius: 24, backgroundColor: colors.primary, gap: 8 },
  weeklyTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weeklyTagText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },
  weeklyTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
  weeklyMeta: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  weeklyTime: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weeklyMetaText: { fontSize: 13, fontWeight: '600', color: '#DDF1F0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  rowText: { fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 },
}))
