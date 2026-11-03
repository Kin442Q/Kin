/**
 * Чистая логика мини-игр: без React и без нативных модулей.
 * Зеркало web/src/lib/games.ts. Потолки очков совпадают с
 * server/src/modules/games/game-registry.ts — сервер отклоняет всё, что выше.
 */

export type Rng = () => number

export const MAX_SCORE = { memory: 1000, math: 200, sequence: 100 } as const

/** Значок игры на карточке и в заголовке. */
export const GAME_EMOJI = { memory: '🃏', math: '➕', sequence: '💡' } as const

// ─── Найди пары ──────────────────────────────────────────────────

export const MEMORY_SYMBOLS = ['🍎', '🚀', '🐱', '⚽', '🎈', '🌟', '🐢', '🎲'] as const

export interface MemoryCard {
  id: number
  symbol: string
}

/** Перемешивание Фишера — Йетса. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Колода из `pairs` пар, перемешанная; у каждой карточки свой id. */
export function createMemoryDeck(pairs = 6, rng: Rng = Math.random): MemoryCard[] {
  const n = Math.min(Math.max(pairs, 2), MEMORY_SYMBOLS.length)
  const symbols = MEMORY_SYMBOLS.slice(0, n)
  return shuffle(
    [...symbols, ...symbols].map((symbol, i) => ({ id: i, symbol })),
    rng,
  )
}

/**
 * Очки за партию: максимум за идеальную игру (минимум ходов — по одному на
 * пару), далее штраф за лишние ходы и за время. Всегда в диапазоне 0..1000.
 */
export function memoryScore(moves: number, seconds: number, pairs = 6): number {
  const extraMoves = Math.max(0, moves - pairs)
  const raw = MAX_SCORE.memory - extraMoves * 40 - Math.max(0, seconds) * 3
  return Math.round(Math.min(MAX_SCORE.memory, Math.max(0, raw)))
}

// ─── Устный счёт ─────────────────────────────────────────────────

export interface MathProblem {
  text: string
  answer: number
}

const randInt = (min: number, max: number, rng: Rng) =>
  min + Math.floor(rng() * (max - min + 1))

/**
 * Пример для текущего уровня (уровень растёт с числом верных ответов подряд):
 * 0–2 — сложение и вычитание до 20, 3–6 — до 100, дальше добавляется умножение.
 * Ответ всегда целый и неотрицательный.
 */
export function makeProblem(level: number, rng: Rng = Math.random): MathProblem {
  const lvl = Math.max(0, Math.floor(level))
  const max = lvl < 3 ? 20 : 100
  const ops = lvl < 7 ? ['+', '−'] : ['+', '−', '×']
  const op = ops[randInt(0, ops.length - 1, rng)]

  if (op === '×') {
    const a = randInt(2, 9, rng)
    const b = randInt(2, 9, rng)
    return { text: `${a} × ${b}`, answer: a * b }
  }
  let a = randInt(1, max, rng)
  let b = randInt(1, max, rng)
  if (op === '−' && b > a) [a, b] = [b, a] // без отрицательных ответов
  return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b }
}

/** Ответ ученика → число (пробелы допустимы); мусор → null. */
export function parseAnswer(input: string): number | null {
  const t = input.trim()
  if (!/^-?\d+$/.test(t)) return null
  return Number(t)
}

// ─── Запомни порядок ─────────────────────────────────────────────

export const SEQUENCE_PADS = 4

/** Последовательность на один шаг длиннее предыдущей. */
export function extendSequence(
  prev: readonly number[],
  rng: Rng = Math.random,
): number[] {
  return [...prev, Math.floor(rng() * SEQUENCE_PADS)]
}

/**
 * Проверка нажатия: `pressed` — всё, что ученик нажал в этом раунде.
 * 'wrong' — ошибся, 'continue' — пока верно, 'done' — повторил всю последовательность.
 */
export function checkSequence(
  sequence: readonly number[],
  pressed: readonly number[],
): 'wrong' | 'continue' | 'done' {
  for (let i = 0; i < pressed.length; i++) {
    if (pressed[i] !== sequence[i]) return 'wrong'
  }
  return pressed.length === sequence.length ? 'done' : 'continue'
}

/** Очки = число полностью пройденных уровней (потолок — как на сервере). */
export const sequenceScore = (completedLevels: number) =>
  Math.min(MAX_SCORE.sequence, Math.max(0, Math.floor(completedLevels)))
