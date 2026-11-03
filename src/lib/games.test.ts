import { describe, it, expect } from 'vitest'
import {
  MAX_SCORE,
  MEMORY_SYMBOLS,
  checkSequence,
  createMemoryDeck,
  extendSequence,
  makeProblem,
  memoryScore,
  parseAnswer,
  sequenceScore,
  shuffle,
} from './games'

/** Детерминированный генератор для воспроизводимых тестов. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('shuffle / createMemoryDeck', () => {
  it('перемешивание не теряет и не добавляет элементы и не меняет исходный массив', () => {
    const src = [1, 2, 3, 4, 5, 6]
    const out = shuffle(src, seeded(1))
    expect([...out].sort()).toEqual(src)
    expect(src).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('колода: каждая карточка встречается ровно дважды, id уникальны', () => {
    const deck = createMemoryDeck(6, seeded(7))
    expect(deck).toHaveLength(12)
    expect(new Set(deck.map((c) => c.id)).size).toBe(12)
    const counts = new Map<string, number>()
    for (const c of deck) counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
    expect(counts.size).toBe(6)
  })

  it('число пар ограничено: от 2 до числа символов', () => {
    expect(createMemoryDeck(0)).toHaveLength(4)
    expect(createMemoryDeck(99)).toHaveLength(MEMORY_SYMBOLS.length * 2)
  })
})

describe('memoryScore', () => {
  it('идеальная партия — максимум; лишние ходы и время снижают очки', () => {
    expect(memoryScore(6, 0)).toBe(1000)
    expect(memoryScore(8, 0)).toBe(920) // два лишних хода
    expect(memoryScore(6, 30)).toBe(910) // 30 секунд
    expect(memoryScore(8, 30)).toBeLessThan(memoryScore(6, 30))
  })

  it('никогда не выходит за 0..1000 (иначе сервер отклонит результат)', () => {
    expect(memoryScore(1, 0)).toBe(MAX_SCORE.memory)
    expect(memoryScore(500, 500)).toBe(0)
    expect(memoryScore(6, -10)).toBe(MAX_SCORE.memory)
  })
})

describe('makeProblem', () => {
  it('ответ всегда целый и неотрицательный на любом уровне', () => {
    const rng = seeded(42)
    for (let level = 0; level < 15; level++) {
      for (let i = 0; i < 200; i++) {
        const p = makeProblem(level, rng)
        expect(Number.isInteger(p.answer)).toBe(true)
        expect(p.answer).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('ответ совпадает с текстом примера', () => {
    const rng = seeded(5)
    for (let i = 0; i < 300; i++) {
      const p = makeProblem(i % 12, rng)
      const [a, op, b] = p.text.split(' ')
      const x = Number(a)
      const y = Number(b)
      const expected = op === '+' ? x + y : op === '−' ? x - y : x * y
      expect(p.answer).toBe(expected)
    }
  })

  it('умножение появляется только на высоких уровнях', () => {
    const rng = seeded(9)
    const low = Array.from({ length: 300 }, () => makeProblem(2, rng).text)
    expect(low.some((t) => t.includes('×'))).toBe(false)
    const high = Array.from({ length: 300 }, () => makeProblem(10, rng).text)
    expect(high.some((t) => t.includes('×'))).toBe(true)
  })

  it('на первых уровнях числа не больше 20', () => {
    const rng = seeded(3)
    for (let i = 0; i < 200; i++) {
      const [a, , b] = makeProblem(0, rng).text.split(' ')
      expect(Number(a)).toBeLessThanOrEqual(20)
      expect(Number(b)).toBeLessThanOrEqual(20)
    }
  })
})

describe('parseAnswer', () => {
  it('целые числа с пробелами по краям; остальное — null', () => {
    expect(parseAnswer(' 42 ')).toBe(42)
    expect(parseAnswer('0')).toBe(0)
    expect(parseAnswer('-3')).toBe(-3)
    for (const bad of ['', 'abc', '4.5', '1e3', '12a', '--1']) expect(parseAnswer(bad)).toBeNull()
  })
})

describe('последовательность', () => {
  it('extendSequence добавляет один шаг в пределах 0..3 и не меняет прежнюю', () => {
    const rng = seeded(11)
    let seq: number[] = []
    for (let i = 0; i < 20; i++) {
      const prev = seq
      seq = extendSequence(prev, rng)
      expect(seq).toHaveLength(prev.length + 1)
      expect(seq.slice(0, -1)).toEqual(prev)
      expect(seq[seq.length - 1]).toBeGreaterThanOrEqual(0)
      expect(seq[seq.length - 1]).toBeLessThanOrEqual(3)
    }
  })

  it('checkSequence: верно / продолжаем / ошибка / готово', () => {
    const seq = [2, 0, 3]
    expect(checkSequence(seq, [])).toBe('continue')
    expect(checkSequence(seq, [2])).toBe('continue')
    expect(checkSequence(seq, [2, 0])).toBe('continue')
    expect(checkSequence(seq, [2, 0, 3])).toBe('done')
    expect(checkSequence(seq, [1])).toBe('wrong')
    expect(checkSequence(seq, [2, 1])).toBe('wrong')
    expect(checkSequence(seq, [2, 0, 3, 1])).toBe('wrong') // лишнее нажатие
  })

  it('sequenceScore: число пройденных уровней в пределах потолка', () => {
    expect(sequenceScore(0)).toBe(0)
    expect(sequenceScore(7.9)).toBe(7)
    expect(sequenceScore(-2)).toBe(0)
    expect(sequenceScore(10_000)).toBe(MAX_SCORE.sequence)
  })
})

describe('потолки очков совпадают с сервером', () => {
  it('значения', () => {
    expect(MAX_SCORE).toEqual({ memory: 1000, math: 200, sequence: 100 })
  })
})
