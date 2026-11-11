import { uiText } from '../i18n/uiText'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import {
  ChevronRight,
  CircleHelp,
  FileText,
  FolderOpen,
  Library,
  ListChecks,
  Play,
  Puzzle,
  Search,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react-native'

import { Text } from '../components/Text'
import Screen from '../components/Screen'
import GradientView from '../components/GradientView'
import IconTile from '../components/IconTile'
import { ScreenHeading } from '../components/ui'
import { colors, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { hasFeature } from '../lib/features'
import { quizApi, type QuizSummary } from '../api/learning'
import { studentApi, type StudentProfile } from '../api/student'
import { maxQuizXp, minutesLabel } from '../lib/progress'
import { parseClassName, plural } from '../lib/classes'
import { themedStyles } from '../theme/themedStyles'

interface GridCard {
  key: string
  title: string
  sub: string
  icon: LucideIcon
  bg: string
  fg: string
  onPress: () => void
}

/** Вкладка «Учёба»: квиз недели, библиотека, материалы, квизы, подготовка к экзаменам и игры (что включено у школы). */
export default function StudentLearnScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((s) => s.user)

  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const quizOn = hasFeature(user, 'quiz')

  useFocusEffect(
    useCallback(() => {
      let alive = true
      studentApi
        .me()
        .then((p) => alive && setProfile(p))
        .catch(() => undefined)
      if (quizOn) {
        quizApi
          .list()
          .then((list) => alive && setQuizzes(list))
          .catch(() => alive && setQuizzes([]))
      }
      return () => {
        alive = false
      }
    }, [quizOn]),
  )

  // «Квиз недели»: самый свежий квиз, который ученик ещё не проходил
  const weekly = quizzes.find((q) => !q.myBest && q.questionsCount > 0) ?? null
  const newQuizzes = quizzes.filter((q) => !q.myBest).length
  const grade = profile ? parseClassName(profile.group.name).grade : null

  const cards: (GridCard | false)[] = [
    hasFeature(user, 'library') && {
      key: 'books',
      title: uiText("Библиотека"),
      sub: grade ? uiText("Книги для {0} класса", grade) : uiText("Книги и учебники"),
      icon: Library,
      bg: 'rgba(13,122,124,0.13)',
      fg: colors.primary,
      onPress: () => navigation.navigate('StudentLibrary', { kind: 'books', grade: grade ?? undefined }),
    },
    hasFeature(user, 'library') && {
      key: 'materials',
      title: uiText("Материалы"),
      sub: uiText("К урокам учителей"),
      icon: FolderOpen,
      bg: 'rgba(246,196,106,0.3)',
      fg: colors.yellowDeep,
      onPress: () => navigation.navigate('StudentLibrary', { kind: 'materials' }),
    },
    hasFeature(user, 'lesson_materials') && {
      key: 'lesson-materials',
      title: uiText("Материалы класса"),
      sub: uiText("Файлы и ссылки к урокам"),
      icon: FileText,
      bg: colors.lilacSoft,
      fg: colors.lilacDeep,
      onPress: () => navigation.navigate('StudentMaterials'),
    },
    quizOn && {
      key: 'quizzes',
      title: uiText("Квизы"),
      sub: newQuizzes > 0 ? `${newQuizzes} ${plural(newQuizzes, [uiText("новый"), uiText("новых"), uiText("новых")])}` : uiText("Тесты с проверкой"),
      icon: CircleHelp,
      bg: 'rgba(255,138,101,0.2)',
      fg: colors.roseDeep,
      onPress: () => navigation.navigate('StudentQuizzes'),
    },
    hasFeature(user, 'exam_prep') && {
      key: 'exams',
      title: uiText("К экзаменам"),
      sub: uiText("Тренировочные тесты"),
      icon: Target,
      bg: 'rgba(158,221,217,0.45)',
      fg: colors.primaryDeep,
      onPress: () => navigation.navigate('StudentExam'),
    },
  ]
  const visible = cards.filter((c): c is GridCard => !!c)
  const rows: GridCard[][] = []
  for (let i = 0; i < visible.length; i += 2) rows.push(visible.slice(i, i + 2))

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeading
          eyebrow={profile ? `${profile.firstName} · ${profile.group.name}` : undefined}
          title={uiText("Учёба")}
          size={28}
          right={
            hasFeature(user, 'library') ? (
              <Pressable
                onPress={() => navigation.navigate('StudentLibrary', {})}
                accessibilityRole="button"
                accessibilityLabel={uiText("Поиск")}
                style={styles.search}
              >
                <Search size={22} color={colors.text} />
              </Pressable>
            ) : undefined
          }
        />

        {weekly && (
          <Pressable
            onPress={() => navigation.navigate('StudentQuizPlay', { id: weekly.id })}
            accessibilityRole="button"
            accessibilityLabel={uiText("Квиз недели: {0}", weekly.title)}
            style={({ pressed }) => pressed && { opacity: 0.92 }}
          >
            <GradientView from="#FF9A76" via="#FF8A65" viaAt={0.4} to="#F6C46A" style={[styles.weekly, shadow.lg]}>
              <View style={styles.weeklyCircle} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.weeklyTag}>{uiText("КВИЗ НЕДЕЛИ · +")}{maxQuizXp(weekly.questionsCount)} XP</Text>
                <Text style={styles.weeklyTitle} numberOfLines={2}>
                  {weekly.title}
                </Text>
                <View style={styles.weeklyMeta}>
                  <View style={styles.weeklyMetaItem}>
                    <ListChecks size={15} color="#10282A" />
                    <Text style={styles.weeklyMetaText}>
                      {weekly.questionsCount} {plural(weekly.questionsCount, [uiText("вопрос"), uiText("вопроса"), uiText("вопросов")])}
                    </Text>
                  </View>
                  {minutesLabel(weekly.timeLimitSec) ? (
                    <View style={styles.weeklyMetaItem}>
                      <Timer size={15} color="#10282A" />
                      <Text style={styles.weeklyMetaText}>{minutesLabel(weekly.timeLimitSec)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.play}>
                <Play size={26} color="#FFFFFF" fill="#FFFFFF" />
              </View>
            </GradientView>
          </Pressable>
        )}

        {rows.map((row, i) => (
          <View key={i} style={styles.gridRow}>
            {row.map((c) => (
              <Pressable key={c.key} onPress={c.onPress} accessibilityRole="button" style={styles.gridCell}>
                <View style={[styles.gridCard, shadow.md]}>
                  <IconTile icon={c.icon} bg={c.bg} fg={c.fg} size={48} />
                  <View>
                    <Text style={styles.gridTitle}>{c.title}</Text>
                    <Text style={styles.gridSub}>{c.sub}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
            {row.length === 1 && <View style={styles.gridCell} />}
          </View>
        ))}

        {hasFeature(user, 'games') && (
          <Pressable onPress={() => navigation.navigate('StudentGames')} accessibilityRole="button">
            <GradientView from="rgba(140,120,230,0.18)" to="rgba(95,208,203,0.18)" style={styles.games}>
              <IconTile icon={Puzzle} bg="rgba(140,120,230,0.16)" fg={colors.lilacDeep} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.gridTitle}>{uiText("Игры для мозга")}</Text>
                <Text style={styles.gridSub}>{uiText("Память, счёт, последовательности")}</Text>
              </View>
              <ChevronRight size={20} color={colors.muted} />
            </GradientView>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  search: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekly: { padding: 18, borderRadius: 26, flexDirection: 'row', alignItems: 'center', gap: 14 },
  weeklyCircle: {
    position: 'absolute',
    right: -26,
    bottom: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  weeklyTag: { fontSize: 12, fontWeight: '800', letterSpacing: 0.7, color: '#10282A' },
  weeklyTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: '#10282A' },
  weeklyMeta: { flexDirection: 'row', gap: 12 },
  weeklyMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weeklyMetaText: { fontSize: 13, fontWeight: '700', color: '#10282A' },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10282A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridRow: { flexDirection: 'row', gap: 10 },
  gridCell: { flex: 1 },
  gridCard: {
    height: 138,
    padding: 16,
    borderRadius: 24,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  gridTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  gridSub: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 2 },
  games: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
}))
