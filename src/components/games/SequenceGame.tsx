import { useEffect, useRef, useState } from 'react'

import { SP } from '../sprout'
import { checkSequence, extendSequence, sequenceScore } from '../../lib/games'
import type { GameProps } from './types'

const PAD_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B']
type Phase = 'showing' | 'input' | 'over'

/** «Запомни порядок»: смотри, как загораются огоньки, и повтори. С каждым уровнем длиннее. */
export default function SequenceGame({ onFinish }: GameProps) {
  const [sequence, setSequence] = useState<number[]>(() => extendSequence(extendSequence([])))
  const [phase, setPhase] = useState<Phase>('showing')
  const [lit, setLit] = useState<number | null>(null)
  const [pressed, setPressed] = useState<number[]>([])
  const [completed, setCompleted] = useState(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>()

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
    phase === 'showing' ? 'Смотри внимательно…' : phase === 'input' ? 'Повтори порядок!' : 'Ошибка — игра окончена'

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: SP.textMid, fontWeight: 600 }}>
        Уровень {completed + 1} · {status}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          maxWidth: 280,
          margin: '18px auto 0',
        }}
      >
        {PAD_COLORS.map((color, pad) => (
          <button
            key={pad}
            type="button"
            aria-label={`Огонёк ${pad + 1}`}
            disabled={phase !== 'input'}
            onClick={() => press(pad)}
            style={{
              height: 110,
              borderRadius: 18,
              border: 'none',
              background: color,
              opacity: lit === pad ? 1 : 0.35,
              transform: lit === pad ? 'scale(1.05)' : 'none',
              boxShadow: lit === pad ? `0 0 24px ${color}` : 'none',
              cursor: phase === 'input' ? 'pointer' : 'default',
              transition: 'opacity 0.12s, transform 0.12s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
