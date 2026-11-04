import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Gamepad2 } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { colors } from '../theme/colors'
import { gamesApi, type GameInfo } from '../api/learning'
import { GAME_EMOJI } from '../lib/games'

/** Игры для развития мозга: карточки с рекордом ученика. */
export default function StudentGamesScreen() {
  const navigation = useNavigation<any>()
  const [games, setGames] = useState<GameInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setGames(await gamesApi.list())
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось загрузить игры')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Вернулись из партии — подтянуть новый рекорд.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <Screen>
      <StackHeader title="Игры для мозга" />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.key}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
            <EmptyState icon={<Gamepad2 size={34} color={colors.muted} />} title="Игр пока нет" />
          }
          renderItem={({ item: g }) => (
            <Card padding={16}>
              <Text style={styles.emoji}>{GAME_EMOJI[g.key]}</Text>
              <Text style={styles.title}>{g.title}</Text>
              <Text style={styles.skill}>{g.skill}</Text>
              <Text style={styles.desc}>{g.description}</Text>
              <View style={styles.footer}>
                <Text style={styles.meta}>
                  {g.myBest != null ? `Мой рекорд: ${g.myBest}` : 'Ещё не играл(а)'}
                </Text>
                <Btn size="sm" onPress={() => navigation.navigate('StudentGame', { game: g.key, title: g.title })}>
                  Играть
                </Btn>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  emoji: { fontSize: 34 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
  skill: { fontSize: 12, fontWeight: '700', color: colors.lilacDeep, marginTop: 2 },
  desc: { fontSize: 13, color: colors.textMid, marginTop: 6, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  meta: { fontSize: 12, color: colors.muted },
})
