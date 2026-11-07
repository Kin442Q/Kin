import { plural } from './classes'

/** Совпадает с XP_PER_CORRECT_ANSWER на сервере (student-progress.ts): 10 XP за каждый верный ответ в квизе. */
export const XP_PER_CORRECT_ANSWER = 10

/** Сколько XP можно получить за квиз без ошибок: квиз из 15 вопросов даёт до 150 XP. */
export const maxQuizXp = (questionsCount: number) => Math.max(0, questionsCount) * XP_PER_CORRECT_ANSWER

/** «5 дней подряд»; без серии — приглашение начать. */
export function streakLabel(days: number): string {
  if (days <= 0) return 'Начните серию сегодня'
  return `${days} ${plural(days, ['день', 'дня', 'дней'])} подряд`
}

/** «1 240 XP» с неразрывным пробелом в тысячах. */
export const xpLabel = (xp: number) => `${xp.toLocaleString('ru-RU')} XP`

/** «10 минут», «1 минута»: лимит квиза словами; без лимита — null. */
export function minutesLabel(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.max(1, Math.round(seconds / 60))
  return `${m} ${plural(m, ['минута', 'минуты', 'минут'])}`
}
