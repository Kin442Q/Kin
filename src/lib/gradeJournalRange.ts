// Диапазон дат в журнале оценок: какие колонки-уроки показывать.
// Все даты — строки «YYYY-MM-DD» (сравниваются как строки), границы включительно.

export interface DateRange {
  start: string
  end: string
}

/** Выбранный вручную диапазон + границы четверти, для которой он выбран. */
export interface StoredRange {
  bounds: DateRange
  range: DateRange
}

const sameRange = (a: DateRange, b: DateRange) => a.start === b.start && a.end === b.end

/**
 * Приводит выбранный диапазон к границам четверти. Без выбора (null) — вся
 * четверть. Диапазон не может выйти за четверть; если он целиком вне четверти,
 * показываем всю четверть.
 */
export function clampRange(custom: DateRange | null, bounds: DateRange): DateRange {
  if (!custom) return bounds
  const lo = custom.start <= custom.end ? custom.start : custom.end
  const hi = custom.start <= custom.end ? custom.end : custom.start
  const start = lo > bounds.start ? lo : bounds.start
  const end = hi < bounds.end ? hi : bounds.end
  return start > end ? bounds : { start, end }
}

/**
 * Какой диапазон показывать сейчас. Выбор действует только для той четверти, в
 * которой он сделан: при смене четверти (другие границы) возвращаемся ко всей
 * четверти.
 */
export function resolveRange(stored: StoredRange | null, bounds: DateRange): DateRange {
  if (!stored || !sameRange(stored.bounds, bounds)) return bounds
  return clampRange(stored.range, bounds)
}

/** Сужен ли диапазон относительно всей четверти. */
export function isNarrowed(range: DateRange, bounds: DateRange): boolean {
  return !sameRange(range, bounds)
}

/** Колонки-даты, попавшие в диапазон (порядок сохраняется). */
export function filterColumnsByRange(columns: string[], range: DateRange): string[] {
  return columns.filter((d) => d >= range.start && d <= range.end)
}

/**
 * Запоминаем выбор. Если выбрана вся четверть — это то же, что «без выбора»
 * (null), чтобы кнопка «Сбросить» не горела зря.
 */
export function storeRange(range: DateRange | null, bounds: DateRange): StoredRange | null {
  if (!range) return null
  const clamped = clampRange(range, bounds)
  return sameRange(clamped, bounds) ? null : { bounds, range: clamped }
}

/**
 * Вручную добавили урок на дату вне показанного диапазона: расширяем диапазон
 * ровно настолько, чтобы новая колонка появилась (а не пропала молча).
 */
export function extendToInclude(range: DateRange, bounds: DateRange, date: string): DateRange {
  if (date < bounds.start || date > bounds.end) return range
  return {
    start: date < range.start ? date : range.start,
    end: date > range.end ? date : range.end,
  }
}
