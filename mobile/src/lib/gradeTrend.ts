import { uiText } from '../i18n/uiText'
import dayjs from 'dayjs'

interface MarkLike {
  subjectId: string
  value: number
  /** Дата оценки: `2026-11-04` или полный ISO. */
  date: string
}

/** Общий средний балл: среднее из средних по предметам (так же считает сам экран оценок). */
export function overallAverage(marks: MarkLike[]): number | null {
  const bySubject = new Map<string, { sum: number; count: number }>()
  for (const m of marks) {
    const cur = bySubject.get(m.subjectId) ?? { sum: 0, count: 0 }
    cur.sum += m.value
    cur.count += 1
    bySubject.set(m.subjectId, cur)
  }
  if (bySubject.size === 0) return null
  let total = 0
  for (const { sum, count } of bySubject.values()) total += sum / count
  return total / bySubject.size
}

/**
 * Как изменился общий средний балл за последние 7 дней: сегодняшний минус тот, что был неделю назад.
 * null, если сравнивать не с чем (до этой недели оценок не было) или изменение меньше одной сотой —
 * тогда подпись «за неделю» не показываем.
 */
export function weeklyTrend(marks: MarkLike[], today: string = dayjs().format('YYYY-MM-DD')): number | null {
  const weekAgo = dayjs(today).subtract(7, 'day').format('YYYY-MM-DD')
  const before = overallAverage(marks.filter((m) => m.date.slice(0, 10) <= weekAgo))
  const now = overallAverage(marks.filter((m) => m.date.slice(0, 10) <= today))
  if (before == null || now == null) return null
  const delta = Math.round((now - before) * 10) / 10
  return delta === 0 ? null : delta
}

/** «+0.2 за неделю» или «−0.1 за неделю» (настоящий минус, а не дефис). */
export function trendLabel(delta: number): string {
  const sign = delta > 0 ? '+' : '−'
  return uiText("{0}{1} за неделю", sign, Math.abs(delta).toFixed(1))
}
