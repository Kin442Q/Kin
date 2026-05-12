import dayjs from 'dayjs'

/* ============================================================
   Форматтеры для UI. Всё округляется и (для KPI) компактится,
   чтобы карточки не разъезжались на огромных значениях.
   ============================================================ */

/**
 * Полное форматирование суммы в сомони с разделителями тысяч.
 * Используется в таблицах и подробных карточках.
 */
export function formatMoney(value: number | undefined | null): string {
  if (value == null || !isFinite(value) || isNaN(value)) return '—'
  const v = Math.round(value)
  return new Intl.NumberFormat('ru-RU').format(v) + ' сомони'
}

/**
 * Компактное форматирование суммы для KPI-карточек:
 *   1234         -> "1 234 сомони"
 *   12 345       -> "12,3 тыс. сомони"
 *   1 234 567    -> "1,23 млн сомони"
 *   1 234 000 000 -> "1,23 млрд сомони"
 *
 * Гарантирует, что значение всегда умещается в карточке.
 */
export function formatMoneyCompact(value: number | undefined | null): string {
  if (value == null || !isFinite(value) || isNaN(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs < 10_000) {
    return sign + new Intl.NumberFormat('ru-RU').format(Math.round(abs)) + ' сомони'
  }
  if (abs < 1_000_000) {
    return sign + (abs / 1_000).toFixed(1).replace('.', ',') + ' тыс. сомони'
  }
  if (abs < 1_000_000_000) {
    return sign + (abs / 1_000_000).toFixed(2).replace('.', ',') + ' млн сомони'
  }
  if (abs < 1_000_000_000_000) {
    return sign + (abs / 1_000_000_000).toFixed(2).replace('.', ',') + ' млрд сомони'
  }
  return sign + abs.toExponential(2) + ' сомони'
}

/** Число без валюты для KPI-карточек («Детей: 60»). */
export function formatNumberCompact(value: number | undefined | null): string {
  if (value == null || !isFinite(value) || isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs < 10_000) return new Intl.NumberFormat('ru-RU').format(Math.round(value))
  if (abs < 1_000_000) return (value / 1_000).toFixed(1).replace('.', ',') + ' тыс.'
  return (value / 1_000_000).toFixed(2).replace('.', ',') + ' млн'
}

export function formatNumber(value: number | undefined | null): string {
  if (value == null || !isFinite(value) || isNaN(value)) return '—'
  return new Intl.NumberFormat('ru-RU').format(Math.round(value))
}

export function formatDate(d?: string): string {
  if (!d) return '—'
  return dayjs(d).format('DD.MM.YYYY')
}

export function formatMonth(m?: string): string {
  if (!m) return '—'
  return dayjs(m + '-01').format('MMMM YYYY')
}

export function calcAge(birthDate: string): number {
  const b = dayjs(birthDate)
  if (!b.isValid()) return 0
  return dayjs().diff(b, 'year')
}

/** 0.85 -> "85%" с проверкой на NaN/Infinity. */
export function formatPercent(p: number, digits = 0): string {
  if (!isFinite(p) || isNaN(p)) return '—'
  // Защита от безумных значений
  const capped = Math.max(-9.99, Math.min(9.99, p))
  return (capped * 100).toFixed(digits) + '%'
}
