import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { colors, radius } from '../../theme/colors'
import { MAX_SCORE, makeProblem, parseAnswer } from '../../lib/games'
import type { GameProps } from './types'

const DURATION = 60

/** «Устный счёт»: 60 секунд, каждый верный ответ — очко. Сложность растёт сама. */
export default function MathGame({ onFinish }: GameProps) {
  const [left, setLeft] = useState(DURATION)
  const [correct, setCorrect] = useState(0)
  const [problem, setProblem] = useState(() => makeProblem(0))
  const [value, setValue] = useState('')
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const correctRef = useRef(0)
  const finished = useRef(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    const t = setInterval(() => setLeft((l) => l - 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (left <= 0 && !finished.current) {
      finished.current = true
      onFinish({ score: Math.min(correctRef.current, MAX_SCORE.math) })
    }
  }, [left, onFinish])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const submit = () => {
    if (left <= 0) return
    const n = parseAnswer(value)
    if (n === null) return
    const ok = n === problem.answer
    if (ok) {
      correctRef.current += 1
      setCorrect(correctRef.current)
    }
    setFlash(ok ? 'ok' : 'bad')
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 250)
    setValue('')
    // сложность растёт с каждыми тремя верными ответами
    setProblem(makeProblem(Math.floor(correctRef.current / 3)))
    inputRef.current?.focus()
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.stats}>
        <Text style={styles.stat}>Осталось: {Math.max(left, 0)} с</Text>
        <Text style={styles.stat}>Верно: {correct}</Text>
      </View>
      <Text
        style={[
          styles.problem,
          {
            color:
              flash === 'ok'
                ? colors.primaryDeep
                : flash === 'bad'
                  ? colors.danger
                  : colors.text,
          },
        ]}
      >
        {problem.text} = ?
      </Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        keyboardType="number-pad"
        returnKeyType="done"
        blurOnSubmit={false}
        editable={left > 0}
        autoFocus
        placeholder="Ответ"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 24 },
  stat: { color: colors.textMid, fontWeight: '700', fontSize: 14 },
  problem: { fontSize: 44, fontWeight: '800', marginVertical: 24 },
  input: {
    width: 200,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
})
