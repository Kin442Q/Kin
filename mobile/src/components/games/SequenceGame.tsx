import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../Text'

import { colors, radius } from '../../theme/colors'
import { checkSequence, extendSequence, sequenceScore } from '../../lib/games'
import type { GameProps } from './types'

const PAD_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B']
type Phase = 'showing' | 'input' | 'over'

/** «Запомни порядок»: смотри, как загораются огоньки, и повтори. С каждым уровнем длиннее. */
export default function SequenceGame({ onFinish }: GameProps) {
  const [sequence, setSequence] = useState<number[]>(() =>
    extendSequence(extendSequence([])),
  )
  const [phase, setPhase] = useState<Phase>('showing')
  const [lit, setLit] = useState<number | null>(null)
  const [pressed, setPressed] = useState<number[]>([])
  const [completed, setCompleted] = useState(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Показ последовательности: огоньки загораются по очереди.
  useEffect(() => {
    if (phase !== 'showing') return
    const timers: ReturnType<typeof setTimeout>[] = []
    sequence.forEach((pad, i) => {
      timers.push(setTimeout(() => setLit(pad), 700 + i * 800))
      timers.push(setTimeout(() => setLit(null), 700 + i * 800 + 500))
    })
    timers.push(
      setTimeout(() => {
        setPressed([])
        setPhase('input')
      }, 700 + sequence.length * 800),
    )
    return () => timers.forEach(clearTimeout)
  }, [phase, sequence])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const press = (pad: number) => {
    if (phase !== 'input') return
    setLit(pad)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setLit(null), 180)

    const next = [...pressed, pad]
    const verdict = checkSequence(sequence, next)
    if (verdict === 'wrong') {
      setPhase('over')
      onFinish({ score: sequenceScore(completed), level: completed + 1 })
    } else if (verdict === 'done') {
      setCompleted((c) => c + 1)
      setSequence((s) => extendSequence(s))
      setPhase('showing')
    } else {
      setPressed(next)
    }
  }

  const status =
    phase === 'showing'
      ? 'Смотри внимательно…'
      : phase === 'input'
        ? 'Повтори порядок!'
        : 'Ошибка — игра окончена'

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.status}>
        Уровень {completed + 1} · {status}
      </Text>
      <View style={styles.grid}>
        {PAD_COLORS.map((color, pad) => (
          <Pressable
            key={pad}
            accessibilityLabel={`Огонёк ${pad + 1}`}
            disabled={phase !== 'input'}
            onPress={() => press(pad)}
            style={[
              styles.pad,
              { backgroundColor: color, opacity: lit === pad ? 1 : 0.35 },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  status: { color: colors.textMid, fontWeight: '700', fontSize: 14 },
  grid: {
    width: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    marginTop: 20,
  },
  pad: { width: 123, height: 110, borderRadius: radius.lg },
})
