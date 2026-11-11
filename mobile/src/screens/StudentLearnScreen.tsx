import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  ChevronRight,
  FileText,
  Gamepad2,
  Library,
  ListChecks,
  Target,
  type LucideIcon,
} from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import { colors } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { hasFeature, type FeatureKey } from '../lib/features'

interface Section {
  route: string
  title: string
  text: string
  icon: LucideIcon
  bg: string
  fg: string
  feature: FeatureKey
}

const SECTIONS: Section[] = [
  { route: 'StudentLibrary', title: 'Библиотека', text: 'Книги, статьи, видео и ссылки от учителей', icon: Library, bg: colors.blueSoft, fg: colors.blueDeep, feature: 'library' },
  { route: 'StudentMaterials', title: 'Материалы к урокам', text: 'Файлы, ссылки и тексты от учителей твоего класса', icon: FileText, bg: colors.yellowSoft, fg: colors.yellowDeep, feature: 'lesson_materials' },
  { route: 'StudentQuizzes', title: 'Квизы', text: 'Тесты с мгновенной проверкой и разбором ответов', icon: ListChecks, bg: colors.primarySoft, fg: colors.primaryDeep, feature: 'quiz' },
  { route: 'StudentExam', title: 'Подготовка к экзаменам', text: 'Направления подготовки и твой прогресс', icon: Target, bg: colors.yellowSoft, fg: colors.yellowDeep, feature: 'exam_prep' },
  { route: 'StudentGames', title: 'Игры для мозга', text: 'Память, счёт и внимание. Рейтинг класса', icon: Gamepad2, bg: colors.lilacSoft, fg: colors.lilacDeep, feature: 'games' },
]

/** Вкладка «Учёба»: библиотека, квизы, подготовка к экзаменам и игры (что включено у школы). */
export default function StudentLearnScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const sections = SECTIONS.filter((s) => hasFeature(user, s.feature))

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Учёба</Text>
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

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  rowText: { fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 },
})
