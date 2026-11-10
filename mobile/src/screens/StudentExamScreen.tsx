import { uiText } from '../i18n/uiText'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Target } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import { examTrackApi, type ExamTrack } from '../api/learning'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
/** Подготовка к экзаменам: направления школы и прогресс ученика по каждому. */
export default function StudentExamScreen() {
  const navigation = useNavigation<any>()
  const [tracks, setTracks] = useState<ExamTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setTracks(await examTrackApi.list())
    } catch (e: any) {
      notifyError(e, uiText("Не удалось загрузить направления"))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <Screen>
      <StackHeader title={uiText("К экзаменам")} />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
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
              icon={<Target size={34} color={colors.muted} />}
              title={uiText("Направлений пока нет")}
              hint={uiText("Школа ещё не создала подготовку к экзаменам")}
            />
          }
          renderItem={({ item: t }) => {
            const p = t.progress
            const ratio = p && p.total > 0 ? p.attempted / p.total : 0
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('StudentQuizzes', { examTrackId: t.id, title: t.name })
                }
              >
                <Card padding={14}>
                  <Text style={styles.tTitle}>{t.name}</Text>
                  {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
                  </View>
                  <Text style={styles.meta}>
                    {p
                      ? uiText("Пройдено {0} из {1}", p.attempted, p.total) +
                        (p.avgPercent != null ? uiText("· средний результат {0}%", p.avgPercent) : '')
                      : uiText("Квизов: {0}", t.quizzesCount)}
                  </Text>
                </Card>
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const styles = themedStyles(() => ({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  tTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  desc: { fontSize: 13, color: colors.textMid, marginTop: 3, lineHeight: 18 },
  bar: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  meta: { fontSize: 12, color: colors.muted, marginTop: 6 },
}))
