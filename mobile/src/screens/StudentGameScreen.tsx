import { useCallback, useEffect, useState, type ComponentType } from 'react'
import {
  
  ScrollView,
  View,
} from 'react-native'
import { Text } from '../components/Text'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Trophy } from 'lucide-react-native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import StackHeader from '../components/StackHeader'
import MemoryGame from '../components/games/MemoryGame'
import MathGame from '../components/games/MathGame'
import SequenceGame from '../components/games/SequenceGame'
import type { GameProps, GameResult } from '../components/games/types'
import { colors, radius } from '../theme/colors'
import { gamesApi, type GameKey, type LeaderRow } from '../api/learning'
import { GAME_EMOJI } from '../lib/games'

import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
const GAME_COMPONENTS: Record<GameKey, ComponentType<GameProps>> = {
  memory: MemoryGame,
  math: MathGame,
  sequence: SequenceGame,
}

const MEDAL = ['🥇', '🥈', '🥉']

/** Одна партия игры + рейтинг класса. Результат сохраняется на сервере. */
export default function StudentGameScreen() {
  const navigation = useNavigation()
  const { game, title } = useRoute<any>().params as { game: GameKey; title: string }

  const [round, setRound] = useState(0)
  const [result, setResult] = useState<{ score: number; best: number; isRecord: boolean } | null>(null)
  const [board, setBoard] = useState<LeaderRow[]>([])

  const loadBoard = useCallback(() => {
    gamesApi.leaderboard(game).then(setBoard).catch(() => setBoard([]))
  }, [game])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  const finish = useCallback(
    async (res: GameResult) => {
      try {
        setResult(await gamesApi.submit(game, res))
      } catch (e: any) {
        notifyError(e, { fallback: 'Проверьте интернет', title: 'Результат не сохранился' })
        setResult({ score: res.score, best: res.score, isRecord: false })
      }
      loadBoard()
    },
    [game, loadBoard],
  )

  const Game = GAME_COMPONENTS[game]

  return (
    <Screen>
      <StackHeader title={`${GAME_EMOJI[game]} ${title}`} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card padding={20}>
          {!result ? (
            <Game key={`${game}-${round}`} onFinish={finish} />
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={styles.meta}>Твой результат</Text>
              <Text style={styles.score}>{result.score}</Text>
              {result.isRecord ? (
                <Text style={styles.record}>🏆 Новый рекорд!</Text>
              ) : (
                <Text style={styles.meta}>Лучший результат: {result.best}</Text>
              )}
              <View style={styles.actions}>
                <Btn
                  onPress={() => {
                    setResult(null)
                    setRound((r) => r + 1)
                  }}
                >
                  Играть ещё
                </Btn>
                <Btn variant="secondary" onPress={() => navigation.goBack()}>
                  К списку
                </Btn>
              </View>
            </View>
          )}
        </Card>

        <Card padding={16}>
          <View style={styles.boardHead}>
            <Trophy size={18} color={colors.yellowDeep} />
            <Text style={styles.boardTitle}>Рейтинг класса</Text>
          </View>
          {board.length === 0 ? (
            <Text style={styles.meta}>Пока никто не играл — стань первым!</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {board.map((row) => (
                <View
                  key={row.rank}
                  style={[
                    styles.boardRow,
                    { backgroundColor: row.isMe ? colors.primaryGhost : colors.surfaceAlt },
                  ]}
                >
                  <Text style={styles.rank}>{MEDAL[row.rank - 1] ?? row.rank}</Text>
                  <Text style={[styles.name, row.isMe && { fontWeight: '800' }]}>
                    {row.name}
                    {row.isMe ? ' (ты)' : ''}
                  </Text>
                  <Text style={styles.points}>{row.score}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  container: { padding: 16, paddingBottom: 40, gap: 14 },
  meta: { fontSize: 13, color: colors.muted },
  score: { fontSize: 54, fontWeight: '800', color: colors.primaryDeep },
  record: { fontSize: 15, fontWeight: '800', color: colors.yellowDeep },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  boardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  boardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  rank: { width: 26, textAlign: 'center', fontWeight: '700', color: colors.textMid },
  name: { flex: 1, fontSize: 14, color: colors.text },
  points: { fontSize: 14, fontWeight: '700', color: colors.text },
}))
