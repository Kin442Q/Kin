import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  View,
} from 'react-native'
import { Text } from '../Text'

import { colors, radius } from '../../theme/colors'
import { createMemoryDeck, memoryScore } from '../../lib/games'
import type { GameProps } from './types'

import { themedStyles } from '../../theme/themedStyles'
const PAIRS = 6

/** «Найди пары»: открывай карточки по две. Меньше ходов и времени — больше очков. */
export default function MemoryGame({ onFinish }: GameProps) {
  const [deck] = useState(() => createMemoryDeck(PAIRS))
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [locked, setLocked] = useState(false)
  const [finished, setFinished] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [finished])

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const flip = (id: number) => {
    if (locked || finished || open.includes(id) || matched.includes(id)) return
    const nextOpen = [...open, id]
    setOpen(nextOpen)
    if (nextOpen.length < 2) return

    const nextMoves = moves + 1
    setMoves(nextMoves)
    const [a, b] = nextOpen.map((cardId) => deck.find((c) => c.id === cardId)!)
    if (a.symbol === b.symbol) {
      const nextMatched = [...matched, a.id, b.id]
      setMatched(nextMatched)
      setOpen([])
      if (nextMatched.length === deck.length) {
        setFinished(true)
        onFinish({ score: memoryScore(nextMoves, seconds, PAIRS) })
      }
    } else {
      setLocked(true)
      hideTimer.current = setTimeout(() => {
        setOpen([])
        setLocked(false)
      }, 700)
    }
  }

  return (
    <View>
      <View style={styles.stats}>
        <Text style={styles.stat}>Ходов: {moves}</Text>
        <Text style={styles.stat}>Время: {seconds} с</Text>
      </View>
      <View style={styles.grid}>
        {deck.map((card) => {
          const isMatched = matched.includes(card.id)
          const faceUp = open.includes(card.id) || isMatched
          return (
            <Pressable
              key={card.id}
              accessibilityLabel={faceUp ? card.symbol : 'Закрытая карточка'}
              onPress={() => flip(card.id)}
              style={[
                styles.card,
                {
                  backgroundColor: faceUp ? colors.surfaceSolid : colors.primary,
                  borderColor: isMatched ? colors.primary : colors.borderSoft,
                },
              ]}
            >
              <Text style={styles.symbol}>{faceUp ? card.symbol : '?'}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = themedStyles(() => ({
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  stat: { color: colors.textMid, fontWeight: '700', fontSize: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  card: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontSize: 30, color: '#fff' },
}))
