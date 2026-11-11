import { describe, expect, it } from 'vitest'

import type { TrendPoint } from '../../api/ministryApi'
import { COMPARE_LIMIT, compareData, schoolBands, trendData, type CompareItem } from './charts'

const week = (weekStart: string, over: Partial<TrendPoint> = {}): TrendPoint => ({
  weekStart,
  gradesCount: 10,
  avgPercent: 80,
  quality: 70,
  attendanceMarks: 100,
  attendanceRate: 90,
  ...over,
})

describe('trendData: недели → точки линий', () => {
  it('три линии на неделю, подписи — «день.месяц»', () => {
    const data = trendData([week('2026-10-12')])
    expect(data).toHaveLength(3)
    expect(data.map((d) => d.week)).toEqual(['12.10', '12.10', '12.10'])
    expect(data.map((d) => d.value)).toEqual([80, 70, 90])
  })

  it('нет данных — точки нет, а не ноль', () => {
    const data = trendData([week('2026-10-19', { avgPercent: null, quality: null })])
    expect(data).toHaveLength(1)
    expect(data[0].value).toBe(90)
    expect(trendData([week('2026-10-19', { avgPercent: null, quality: null, attendanceRate: null })])).toEqual([])
  })

  it('ноль — это настоящее значение, его не теряем', () => {
    expect(trendData([week('2026-10-19', { avgPercent: 0, quality: null, attendanceRate: null })])).toHaveLength(1)
  })
})

const school = (avgPercent: number | null, scaleMismatch = false) => ({ avgPercent, flags: { scaleMismatch } })

describe('schoolBands: школы по среднему баллу', () => {
  it('раскладывает по диапазонам, пустые диапазоны не показывает', () => {
    const bands = schoolBands([school(95), school(90), school(80), school(75), school(60), school(30), school(null)])
    const byType = Object.fromEntries(bands.map((b) => [b.type, b.value]))
    expect(byType['90 % и выше']).toBe(2)
    expect(byType['75–89 %']).toBe(2)
    expect(byType['60–74 %']).toBe(1)
    expect(byType['Ниже 60 %']).toBe(1)
    expect(byType['Нет оценок']).toBe(1)
    expect(byType['Проверить шкалу']).toBeUndefined()
  })

  it('школа с оценками выше шкалы не попадает в диапазоны: её 170 % недостоверны', () => {
    const bands = schoolBands([school(170.7, true), school(85)])
    expect(bands.find((b) => b.type === '90 % и выше')).toBeUndefined()
    expect(bands.find((b) => b.type === 'Проверить шкалу')?.value).toBe(1)
    expect(bands.find((b) => b.type === '75–89 %')?.value).toBe(1)
  })

  it('без школ — пусто', () => {
    expect(schoolBands([])).toEqual([])
  })
})

const item = (name: string, over: Partial<CompareItem> = {}): CompareItem => ({
  id: name,
  name,
  quality: 70,
  success: 95,
  attendanceRate: 88,
  ...over,
})

describe('compareData: места → столбцы', () => {
  it('три показателя на место', () => {
    const data = compareData([item('Хорог')])
    expect(data.map((d) => d.metric)).toEqual(['Качество знаний', 'Успеваемость', 'Посещаемость'])
    expect(data.every((d) => d.place === 'Хорог')).toBe(true)
  })

  it('нет данных — столбца нет', () => {
    expect(compareData([item('Рушан', { quality: null, success: null })]).map((d) => d.metric)).toEqual(['Посещаемость'])
    expect(compareData([item('Пшихаво', { quality: null, success: null, attendanceRate: null })])).toEqual([])
  })

  it('больше лимита мест не рисуем: подписи сольются', () => {
    const many = Array.from({ length: COMPARE_LIMIT + 5 }, (_, i) => item(`Место ${i}`))
    const places = new Set(compareData(many).map((d) => d.place))
    expect(places.size).toBe(COMPARE_LIMIT)
  })
})
