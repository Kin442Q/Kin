import { useEffect, useRef, useState } from 'react'
import { Input } from 'antd'

import { SP } from '../sprout'
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
  const inputRef = useRef<{ focus: () => void } | null>(null)

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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    setTimeout(() => setFlash(null), 250)
    setValue('')
    // сложность растёт с каждыми тремя верными ответами
    setProblem(makeProblem(Math.floor(correctRef.current / 3)))
    inputRef.current?.focus()
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', color: SP.textMid, fontWeight: 600 }}>
        <span>Осталось: {Math.max(left, 0)} с</span>
        <span>Верно: {correct}</span>
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          margin: '22px 0 16px',
          color: flash === 'ok' ? SP.primaryDeep : flash === 'bad' ? SP.danger : SP.text,
          transition: 'color 0.15s',
        }}
        aria-live="polite"
      >
        {problem.text} = ?
      </div>
      <Input
        ref={inputRef as never}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={submit}
        inputMode="numeric"
        disabled={left <= 0}
        placeholder="Ответ и Enter"
        style={{ maxWidth: 220, height: 48, fontSize: 22, textAlign: 'center' }}
      />
    </div>
  )
}
