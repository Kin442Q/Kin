import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { ListChecks } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import { quizApi, type QuizSummary } from '../api/learning'

/**
 * Список квизов. Если открыт из «Подготовки к экзаменам», приходит
 * `examTrackId` и `title` направления — показываем только его квизы.
 */
export default function StudentQuizzesScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const examTrackId: string | undefined = route.params?.examTrackId
  const title: string = route.params?.title ?? 'Квизы'

  const [items, setItems] = useState<QuizSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await quizApi.list(examTrackId ? { examTrackId } : undefined))
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось загрузить квизы')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [examTrackId])

  // Возвращаясь с прохождения, обновляем «лучший результат».
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <Screen>
      <StackHeader title={title} />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
          ListEmptyComponent={
            <EmptyState
              icon={<ListChecks size={34} color={colors.muted} />}
              title="Квизов пока нет"
              hint="Учителя ещё не опубликовали тесты"
            />
          }
          renderItem={({ item: q }) => {
            const best = q.myBest
            const tone =
              !best
                ? null
                : best.percent >= 80
                  ? { bg: colors.primarySoft, fg: colors.primaryDeep }
                  : best.percent >= 50
                    ? { bg: colors.yellowSoft, fg: colors.yellowDeep }
                    : { bg: colors.roseSoft, fg: colors.roseDeep }
            return (
              <Pressable
                onPress={() => navigation.navigate('StudentQuizPlay', { id: q.id })}
              >
                <Card padding={14}>
                  <Text style={styles.qTitle}>{q.title}</Text>
                  {q.description ? (
                    <Text style={styles.desc} numberOfLines={2}>
                      {q.description}
                    </Text>
                  ) : null}
                  <View style={styles.footer}>
                    <Text style={styles.meta}>
                      {q.subject ? `${q.subject.name} · ` : ''}
                      {q.questionsCount} вопр.
                      {q.timeLimitSec ? ` · ${Math.round(q.timeLimitSec / 60)} мин` : ''}
                    </Text>
                    {tone && best ? (
                      <Text style={[styles.badge, { backgroundColor: tone.bg, color: tone.fg }]}>
                        лучший: {best.percent}%
                      </Text>
                    ) : (
                      <Text style={[styles.badge, { backgroundColor: colors.surfaceAlt, color: colors.muted }]}>
                        не проходил(а)
                      </Text>
                    )}
                  </View>
                </Card>
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  qTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  desc: { fontSize: 13, color: colors.textMid, marginTop: 3, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  meta: { flex: 1, fontSize: 12, color: colors.muted },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
})
