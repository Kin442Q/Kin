/**
 * Даты вердикта. Везде работаем со строками «YYYY-MM-DD» (как отчёт директора): даты в базе
 * хранятся как UTC-полночь календарного дня, и строки не зависят от часового пояса сервера.
 */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const DAY_MS = 86_400_000

export const isMonth = (value: string): boolean => MONTH_RE.test(value)

const pad = (n: number) => String(n).padStart(2, '0')

/** Сегодняшний календарный день в школьном часовом поясе (Душанбе). */
export function schoolToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dushanbe',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(day: string, days: number): string {
  return fromUtc(toUtc(day) + days * DAY_MS)
}

/** День недели в нумерации расписания: 1 = понедельник … 7 = воскресенье. */
export function weekdayOf(day: string): number {
  return ((new Date(toUtc(day)).getUTCDay() + 6) % 7) + 1
}

/** Все дни от from до to включительно (пусто, если to раньше from). */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let ms = toUtc(from); ms <= toUtc(to); ms += DAY_MS) days.push(fromUtc(ms))
  return days
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
}

export function monthStart(month: string): string {
  return `${month}-01`
}

export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return fromUtc(Date.UTC(y, m, 0))
}

/** Месяц, в который попадает день. */
export const monthOf = (day: string): string => day.slice(0, 7)
