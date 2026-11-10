import { localizeCopy } from '../i18n/uiText'
import { classKey, classKeyVisual, gradeKeyOf } from './classes'

/** Фильтры списка классов у директора: параллели и «Внимание». */
export type ClassFilterKey = 'all' | 'grades1-4' | 'grades5-9' | 'grades10-11' | 'attention'

export const CLASS_FILTERS: { key: ClassFilterKey; label: string }[] = localizeCopy([
  { key: 'all', label: 'Все' },
  { key: 'grades1-4', label: '1–4' },
  { key: 'grades5-9', label: '5–9' },
  { key: 'grades10-11', label: '10–11' },
  { key: 'attention', label: 'Внимание' },
])

/** Класс требует внимания, если посещаемость сегодня ниже этого порога (в процентах). */
export const ATTENTION_BELOW_PERCENT = 85

export interface FilterableClass {
  name: string
  homeroomTeacher?: { id: string } | null
}

/** Посещаемость каждого класса за день: доля отметок «в школе» от всех отметок класса, в процентах. */
export function attendancePercents(marks: Array<{ groupId: string; status: string }>): Map<string, number> {
  const tally = new Map<string, { present: number; total: number }>()
  for (const m of marks) {
    const cur = tally.get(m.groupId) ?? { present: 0, total: 0 }
    cur.total += 1
    if (m.status === 'PRESENT') cur.present += 1
    tally.set(m.groupId, cur)
  }
  return new Map([...tally].map(([id, t]) => [id, Math.round((t.present / t.total) * 100)]))
}

/**
 * Классу нужно внимание: нет классного руководителя (сервер прислал null) или сегодня заметно меньше детей,
 * чем обычно. Если сервер руководителя не прислал вовсе (undefined), считать его отсутствующим нельзя.
 */
export function needsAttention(c: FilterableClass, percent: number | undefined): boolean {
  return c.homeroomTeacher === null || (percent != null && percent < ATTENTION_BELOW_PERCENT)
}

export function matchesClassFilter(c: FilterableClass, filter: ClassFilterKey, percent: number | undefined): boolean {
  if (filter === 'all') return true
  if (filter === 'attention') return needsAttention(c, percent)
  const k = gradeKeyOf(c.name)
  if (typeof k !== 'number') return false
  if (filter === 'grades1-4') return k >= 1 && k <= 4
  if (filter === 'grades5-9') return k >= 5 && k <= 9
  return k >= 10 && k <= 11
}

/** Поиск по названию класса без учёта регистра и пробелов; латиница и кириллица совпадают («6 B» найдёт «6Б» и «6В»). */
export function matchesClassQuery(name: string, query: string): boolean {
  if (!query.trim()) return true
  return (
    classKey(name).includes(classKey(query)) || classKeyVisual(name).includes(classKeyVisual(query))
  )
}
