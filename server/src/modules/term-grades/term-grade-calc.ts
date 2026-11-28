/**
 * Правило расчёта итога четверти. ЧИСТЫЕ функции: ни базы, ни времени — одни и те же оценки
 * всегда дают один и тот же итог (его можно показать родителю и объяснить, откуда он взялся).
 *
 * Расчётный итог = среднее арифметическое всех оценок ученика по предмету за период (все типы
 * оценок с одним весом), округлённое до целого «половина — вверх»: 3,5 → 4; 3,49 → 3.
 * Посещаемость («н», «б», «у») в расчёт не входит: это не оценки.
 * Если есть оценка выше максимума шкалы школы (или меньше 1), итог не считаем вовсе: у школы,
 * вероятно, неверно указана шкала, и «подрезанный» балл был бы выдумкой.
 *
 * Оценка, поставленная учителем, всегда главнее расчёта (resolveTermGrade).
 */

export type TermGradeSource = 'TEACHER' | 'SYSTEM'

/** Почему итог нельзя посчитать. */
export type CalcBlockReason = 'NO_GRADES' | 'OUT_OF_SCALE'

export interface CalcInput {
  value: number
  /** Дата оценки (@db.Date — UTC-полночь календарного дня). */
  date: Date
}

export interface CalculatedTermGrade {
  /** Расчётный итог; null — посчитать нельзя (см. reason). */
  value: number | null
  /** Средний балл с двумя знаками; null — вместе с value. */
  average: number | null
  /** Сколько оценок за период. */
  count: number
  /** По какую дату есть оценки, YYYY-MM-DD; null — оценок нет. */
  asOf: string | null
  reason: CalcBlockReason | null
}

export interface ManualTermGrade {
  value: number
  setAt: Date
  setBy: { id: string; fullName: string } | null
}

export interface TermGradeView {
  /** Действующий итог: оценка учителя, а без неё расчёт. null — нет ни того, ни другого. */
  value: number | null
  source: TermGradeSource | null
  /** TEACHER — когда поставил учитель (ISO); SYSTEM — по какую дату есть оценки (YYYY-MM-DD). */
  date: string | null
  manual: { value: number; setAt: string; setBy: { id: string; fullName: string } | null } | null
  calculated: CalculatedTermGrade
}

/** Округление «половина — вверх» на целых числах: без ошибок дробной арифметики. */
export function roundHalfUp(sum: number, count: number): number {
  return Math.floor((2 * sum + count) / (2 * count))
}

export function calculateTermGrade(grades: readonly CalcInput[], scaleMax: number): CalculatedTermGrade {
  const count = grades.length
  if (count === 0) return { value: null, average: null, count: 0, asOf: null, reason: 'NO_GRADES' }

  let sum = 0
  let last = grades[0].date
  let outOfScale = false
  for (const g of grades) {
    sum += g.value
    if (g.value < 1 || g.value > scaleMax) outOfScale = true
    if (g.date > last) last = g.date
  }
  const asOf = last.toISOString().slice(0, 10)
  if (outOfScale) return { value: null, average: null, count, asOf, reason: 'OUT_OF_SCALE' }

  return {
    value: roundHalfUp(sum, count),
    average: Number((sum / count).toFixed(2)),
    count,
    asOf,
    reason: null,
  }
}

/** Что действует: оценка учителя, а если её нет — расчёт системы. */
export function resolveTermGrade(
  manual: ManualTermGrade | null | undefined,
  calculated: CalculatedTermGrade,
): TermGradeView {
  if (manual) {
    const setAt = manual.setAt.toISOString()
    return {
      value: manual.value,
      source: 'TEACHER',
      date: setAt,
      manual: { value: manual.value, setAt, setBy: manual.setBy },
      calculated,
    }
  }
  const has = calculated.value !== null
  return {
    value: calculated.value,
    source: has ? 'SYSTEM' : null,
    date: has ? calculated.asOf : null,
    manual: null,
    calculated,
  }
}
