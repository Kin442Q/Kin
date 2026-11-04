import { useEffect, useRef, useState } from 'react'

import { SP } from '../sprout'
import { createMemoryDeck, memoryScore } from '../../lib/games'
import type { GameProps } from './types'

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
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

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
    <div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 14, color: SP.textMid, fontWeight: 600 }}>
        <span>Ходов: {moves}</span>
        <span>Время: {seconds} с</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxWidth: 380, margin: '0 auto' }}>
        {deck.map((card) => {
          const faceUp = open.includes(card.id) || matched.includes(card.id)
          return (
            <button
              key={card.id}
              type="button"
              aria-label={faceUp ? card.symbol : 'Закрытая карточка'}
              onClick={() => flip(card.id)}
              style={{
                aspectRatio: '1',
                fontSize: 34,
                borderRadius: 14,
                border: `2px solid ${matched.includes(card.id) ? SP.primary : SP.borderSoft}`,
                background: faceUp ? SP.surface : `linear-gradient(135deg, ${SP.primary}, ${SP.primaryDeep})`,
                color: faceUp ? 'inherit' : 'transparent',
                cursor: faceUp ? 'default' : 'pointer',
                transition: 'transform 0.2s, background 0.2s',
                transform: faceUp ? 'rotateY(0)' : 'none',
              }}
            >
              {faceUp ? card.symbol : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
