import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatNumberCompact,
  formatDate,
  formatMonth,
  formatPercent,
  calcAge,
} from './format'

describe('formatMoney', () => {
  it('форматирует обычные числа с разделителями', () => {
    expect(formatMoney(1200)).toMatch(/1\D200/)
    expect(formatMoney(1200)).toContain('сомони')
  })
  it('округляет', () => {
    expect(formatMoney(1234.7)).toContain('1 235')
  })
  it('возвращает прочерк для невалидных значений', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney(NaN)).toBe('—')
    expect(formatMoney(Infinity)).toBe('—')
  })
})

describe('formatMoneyCompact', () => {
  it('маленькие — полное число', () => {
    expect(formatMoneyCompact(1500)).toContain('1 500')
  })
  it('тысячи', () => {
    expect(formatMoneyCompact(12500)).toContain('12,5 тыс.')
  })
  it('миллионы', () => {
    expect(formatMoneyCompact(1_500_000)).toContain('1,50 млн')
  })
  it('миллиарды', () => {
    expect(formatMoneyCompact(2_500_000_000)).toContain('2,50 млрд')
  })
  it('отрицательные с минусом', () => {
    expect(formatMoneyCompact(-1500)).toMatch(/^-/)
  })
  it('null → прочерк', () => {
    expect(formatMoneyCompact(null)).toBe('—')
  })
})

describe('formatNumber / formatNumberCompact', () => {
  it('formatNumber простой', () => {
    expect(formatNumber(1234)).toBe('1 234')
  })
  it('formatNumberCompact для KPI', () => {
    expect(formatNumberCompact(50)).toBe('50')
    expect(formatNumberCompact(12500)).toBe('12,5 тыс.')
    expect(formatNumberCompact(1_500_000)).toBe('1,50 млн')
  })
})

describe('formatDate', () => {
  it('форматирует ISO дату', () => {
    expect(formatDate('2026-05-14')).toBe('14.05.2026')
  })
  it('прочерк для пустой', () => {
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
})

describe('formatMonth', () => {
  it('YYYY-MM → MMMM YYYY', () => {
    expect(formatMonth('2026-05')).toMatch(/2026/)
  })
  it('прочерк для пустой', () => {
    expect(formatMonth(undefined)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('0.85 → 85%', () => {
    expect(formatPercent(0.85)).toBe('85%')
  })
  it('0.123 с digits=1 → 12.3%', () => {
    expect(formatPercent(0.123, 1)).toBe('12.3%')
  })
  it('NaN → прочерк', () => {
    expect(formatPercent(NaN)).toBe('—')
    expect(formatPercent(Infinity)).toBe('—')
  })
  it('clamp экстремальных значений', () => {
    expect(formatPercent(100)).toBe('999%')
    expect(formatPercent(-100)).toBe('-999%')
  })
})

describe('calcAge', () => {
  it('считает возраст в годах', () => {
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    expect(calcAge(fiveYearsAgo.toISOString())).toBe(5)
  })
  it('возвращает 0 для невалидной даты', () => {
    expect(calcAge('invalid-date')).toBe(0)
  })
})
