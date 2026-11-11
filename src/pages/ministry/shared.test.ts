import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'

import { heat, num, pct, periodFor, schoolYearStart } from './shared'
import { canSeeMinistry } from '../../components/auth/RequireMinistry'
import { markerColor } from './SchoolsMap'
import { pathsToScope, scopeToPaths } from './ViewersPage'

describe('период сводки', () => {
  const now = dayjs('2026-11-11')

  it('30 и 90 дней считаются включая сегодня', () => {
    expect(periodFor('30', now)).toEqual({ from: '2026-10-13', to: '2026-11-11' })
    expect(periodFor('90', now)).toEqual({ from: '2026-08-14', to: '2026-11-11' })
  })

  it('учебный год начинается 1 сентября: осенью — этого года, весной — прошлого', () => {
    expect(schoolYearStart(dayjs('2026-11-11')).format('YYYY-MM-DD')).toBe('2026-09-01')
    expect(schoolYearStart(dayjs('2026-09-01')).format('YYYY-MM-DD')).toBe('2026-09-01')
    expect(schoolYearStart(dayjs('2027-03-15')).format('YYYY-MM-DD')).toBe('2026-09-01')
    expect(schoolYearStart(dayjs('2026-08-31')).format('YYYY-MM-DD')).toBe('2025-09-01')
    expect(periodFor('year', dayjs('2027-03-15'))).toEqual({ from: '2026-09-01', to: '2027-03-15' })
  })

  it('свой период берёт даты из адресной строки; без них — последние 30 дней', () => {
    expect(periodFor('custom', now, { from: '2026-09-01', to: '2026-10-01' })).toEqual({ from: '2026-09-01', to: '2026-10-01' })
    expect(periodFor('custom', now, { from: '2026-09-01', to: null })).toEqual({ from: '2026-10-13', to: '2026-11-11' })
  })
})

describe('подписи и подсветка', () => {
  it('нет данных показывается тире, а не нулём', () => {
    expect(pct(null)).toBe('—')
    expect(num(undefined)).toBe('—')
    expect(pct(0)).toContain('0')
  })

  it('подсветка: красный для низких значений, зелёный для высоких, наоборот при invert; нет данных — без заливки', () => {
    expect(heat(null, 0, 100)).toBeUndefined()
    expect(heat(0, 0, 100)).toContain('hsla(0,')
    expect(heat(100, 0, 100)).toContain('hsla(130,')
    expect(heat(100, 0, 100, true)).toContain('hsla(0,')
    // за границами шкалы цвет не «уходит»
    expect(heat(500, 0, 100)).toContain('hsla(130,')
    expect(heat(-5, 0, 100)).toContain('hsla(0,')
  })

  it('метка на карте: серая, пока нет оценок', () => {
    expect(markerColor(null)).toBe('#94a3b8')
    expect(markerColor(100)).toContain('hsl(130')
    expect(markerColor(50)).toContain('hsl(0')
  })
})

describe('кто видит кабинет министерства', () => {
  it('наблюдатель и владелец платформы — да; директор школы и остальные — нет', () => {
    expect(canSeeMinistry({ role: 'VIEWER', kindergartenId: null })).toBe(true)
    expect(canSeeMinistry({ role: 'SUPER_ADMIN', kindergartenId: null })).toBe(true)
    expect(canSeeMinistry({ role: 'SUPER_ADMIN', kindergartenId: 'k1' })).toBe(false)
    for (const role of ['admin', 'TEACHER', 'PARENT', 'STUDENT']) expect(canSeeMinistry({ role, kindergartenId: null })).toBe(false)
    expect(canSeeMinistry(null)).toBe(false)
  })
})

describe('охват наблюдателя в форме: область целиком или отдельные районы', () => {
  it('путь из одного элемента — область, из двух — район; повторы и пустое не мешают', () => {
    expect(pathsToScope([['rg_sughd'], ['rg_khatlon', 'ds_vakhsh'], ['rg_khatlon', 'ds_kulob']])).toEqual({
      regionIds: ['rg_sughd'],
      districtIds: ['ds_vakhsh', 'ds_kulob'],
    })
    expect(pathsToScope(undefined)).toEqual({ regionIds: [], districtIds: [] })
  })

  it('охват из сервера превращается в пути каскада и обратно без потерь', () => {
    const viewer = {
      regions: [{ id: 'rg_sughd', nameRu: 'a', nameTg: 'a', nameEn: 'a' }],
      districts: [{ id: 'ds_vakhsh', regionId: 'rg_khatlon', nameRu: 'b', nameTg: 'b', nameEn: 'b' }],
    }
    const paths = scopeToPaths(viewer)
    expect(paths).toEqual([['rg_sughd'], ['rg_khatlon', 'ds_vakhsh']])
    expect(pathsToScope(paths)).toEqual({ regionIds: ['rg_sughd'], districtIds: ['ds_vakhsh'] })
  })
})
