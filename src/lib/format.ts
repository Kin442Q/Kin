import { uiLanguage } from '../i18n/uiText'
import dayjs from 'dayjs'
import { currentLang } from '../i18n'

/** Единицы и разделители по языкам: русский и таджикский — «1 234,5», английский — «1,234.5». */
const UNITS = {
  ru: { cur: 'сомони', k: 'тыс.', m: 'млн', b: 'млрд', locale: 'ru-RU', dec: ',' },
  en: { cur: 'somoni', k: 'K', m: 'M', b: 'B', locale: 'en-US', dec: '.' },
  tg: { cur: 'сомонӣ', k: 'ҳаз.', m: 'млн', b: 'млрд', locale: 'tg-TJ', dec: ',' },
} as const
const units = () => UNITS[currentLang()]
const compact = (n: number, digits: number) => n.toFixed(digits).replace('.', units().dec)

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
  return new Intl.NumberFormat(units().locale).format(v) + ' ' + units().cur
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
    return sign + new Intl.NumberFormat(units().locale).format(Math.round(abs)) + ' ' + units().cur
  }
  if (abs < 1_000_000) {
    return sign + compact(abs / 1_000, 1) + ' ' + units().k + ' ' + units().cur
  }
  if (abs < 1_000_000_000) {
    return sign + compact(abs / 1_000_000, 2) + ' ' + units().m + ' ' + units().cur
  }
  if (abs < 1_000_000_000_000) {
    return sign + compact(abs / 1_000_000_000, 2) + ' ' + units().b + ' ' + units().cur
  }
  return sign + abs.toExponential(2) + ' ' + units().cur
}

/** Число без валюты для KPI-карточек («Детей: 60»). */
export function formatNumberCompact(value: number | undefined | null): string {
  if (value == null || !isFinite(value) || isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs < 10_000) return new Intl.NumberFormat(units().locale).format(Math.round(value))
  if (abs < 1_000_000) return compact(value / 1_000, 1) + ' ' + units().k
  return compact(value / 1_000_000, 2) + ' ' + units().m
}

export function formatNumber(value: number | undefined | null): string {
  if (value == null || !isFinite(value) || isNaN(value)) return '—'
  return new Intl.NumberFormat(units().locale).format(Math.round(value))
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
