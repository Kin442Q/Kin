/**
 * Игровая логика квиза: очки, серия верных ответов, звёзды.
 * Чисто клиентская (показывается ученику в игре); оценка попытки по-прежнему
 * считается сервером и сохраняется как есть.
 */

/** Сколько секунд на вопрос в режиме «на скорость». */
export const SPEED_SECONDS = 20

export const BASE_POINTS = 100
export const SPEED_BONUS_MAX = 50
/** Каждый верный ответ подряд добавляет 10% к очкам, максимум +50%. */
export const STREAK_STEP = 0.1
export const STREAK_MAX_BONUS = 0.5

export interface AnswerPoints {
  correct: boolean
  /** Очки за этот вопрос (0, если неверно) */
  points: number
  /** Серия верных ответов подряд после этого вопроса */
  streak: number
  /** Бонус за скорость (только в режиме «на скорость») */
  speedBonus: number
}

export interface GameSummary {
  xp: number
  bestStreak: number
  stars: 0 | 1 | 2 | 3
  perQuestion: AnswerPoints[]
}

/** Звёзды за процент верных ответов: 50% — 1, 80% — 2, 100% — 3. */
export function starsFor(percent: number): 0 | 1 | 2 | 3 {
  if (percent >= 100) return 3
  if (percent >= 80) return 2
  if (percent >= 50) return 1
  return 0
}

/**
 * @param correctFlags верно ли ответили на каждый вопрос (по порядку)
 * @param secondsUsed  сколько секунд ушло на каждый вопрос (по порядку)
 * @param speedMode    режим «на скорость»: есть бонус за быстрый ответ
 */
export function scoreGame(correctFlags: boolean[], secondsUsed: number[], speedMode: boolean): GameSummary {
  let streak = 0
  let best = 0
  let xp = 0
  const perQuestion = correctFlags.map((correct, i): AnswerPoints => {
    if (!correct) {
      streak = 0
      return { correct: false, points: 0, streak: 0, speedBonus: 0 }
    }
    streak += 1
    best = Math.max(best, streak)
    const used = Math.max(0, secondsUsed[i] ?? SPEED_SECONDS)
    const speedBonus = speedMode
      ? Math.round(SPEED_BONUS_MAX * Math.max(0, (SPEED_SECONDS - used) / SPEED_SECONDS))
      : 0
    const multiplier = 1 + Math.min(STREAK_MAX_BONUS, (streak - 1) * STREAK_STEP)
    const points = Math.round((BASE_POINTS + speedBonus) * multiplier)
    xp += points
    return { correct: true, points, streak, speedBonus }
  })
  const total = correctFlags.length
  const percent = total === 0 ? 0 : Math.round((correctFlags.filter(Boolean).length / total) * 100)
  return { xp, bestStreak: best, stars: starsFor(percent), perQuestion }
}
