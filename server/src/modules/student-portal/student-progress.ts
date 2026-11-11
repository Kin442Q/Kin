/**
 * Серия дней, очки (XP) и уровень ученика. Отдельных таблиц нет: всё считается из того, что ученик уже делает
 * (квизы, игры, отметки «сделал» у домашних заданий), поэтому ничего не нужно мигрировать.
 */

/** 10 XP за каждый верный ответ в квизе: квиз из 15 вопросов даёт до 150 XP. */
export const XP_PER_CORRECT_ANSWER = 10
/** 20 XP за каждое домашнее задание, которое ученик отметил «сделал» (или учитель засчитал). */
export const XP_PER_HOMEWORK = 20
/** 5 XP за каждую сыгранную мини-игру. */
export const XP_PER_GAME = 5
/** Каждые 200 XP — новый уровень. */
export const XP_PER_LEVEL = 200
/** За сколько последних дней ищем занятия для серии. */
export const STREAK_LOOKBACK_DAYS = 60

/** Школы Таджикистана живут по UTC+5 без перехода на летнее время. */
const LOCAL_OFFSET_MS = 5 * 3600_000
const DAY_MS = 24 * 3600_000

/** Календарный день по местному времени: `2026-11-06`. */
function localDay(ts: number): string {
  return new Date(ts + LOCAL_OFFSET_MS).toISOString().slice(0, 10)
}

export interface Level {
  level: number
  /** XP внутри текущего уровня. */
  intoLevel: number
  /** Сколько XP занимает уровень. */
  levelSize: number
}

export function levelOf(xp: number): Level {
  const safe = Math.max(0, Math.floor(xp))
  return { level: Math.floor(safe / XP_PER_LEVEL) + 1, intoLevel: safe % XP_PER_LEVEL, levelSize: XP_PER_LEVEL }
}

export function totalXp(parts: { correctAnswers: number; homework: number; games: number }): number {
  return (
    parts.correctAnswers * XP_PER_CORRECT_ANSWER + parts.homework * XP_PER_HOMEWORK + parts.games * XP_PER_GAME
  )
}

/**
 * Сколько дней подряд у ученика было хотя бы одно занятие. Серия не обрывается, пока не закончился сегодняшний
 * день: если сегодня занятий ещё нет, но вчера были, серия продолжается; если не было и вчера, она 0.
 */
export function streakDays(activity: Date[], now: Date = new Date()): number {
  const days = new Set(activity.map((d) => localDay(d.getTime())))
  let cursor = now.getTime()
  if (!days.has(localDay(cursor))) cursor -= DAY_MS
  let streak = 0
  while (days.has(localDay(cursor))) {
    streak += 1
    cursor -= DAY_MS
  }
  return streak
}
