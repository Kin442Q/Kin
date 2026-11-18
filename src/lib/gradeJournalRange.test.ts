import { describe, expect, it } from 'vitest'
import {
  clampRange,
  extendToInclude,
  filterColumnsByRange,
  isNarrowed,
  resolveRange,
  storeRange,
  type DateRange,
} from './gradeJournalRange'

// 2 четверть: ноябрь — декабрь.
const TERM2: DateRange = { start: '2026-11-02', end: '2026-12-28' }
// 3 четверть: январь — март.
const TERM3: DateRange = { start: '2027-01-11', end: '2027-03-20' }

const COLUMNS = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-10',
  '2026-11-11',
  '2026-12-01',
  '2026-12-28',
]

describe('filterColumnsByRange', () => {
  it('без сужения показывает все уроки четверти', () => {
    expect(filterColumnsByRange(COLUMNS, TERM2)).toEqual(COLUMNS)
  })

  it('оставляет только уроки внутри диапазона, границы включительно', () => {
    expect(filterColumnsByRange(COLUMNS, { start: '2026-11-04', end: '2026-11-11' })).toEqual([
      '2026-11-04',
      '2026-11-10',
      '2026-11-11',
    ])
  })

  it('«от какого числа»: диапазон от даты и до конца четверти', () => {
    expect(filterColumnsByRange(COLUMNS, { start: '2026-11-10', end: TERM2.end })).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-12-01',
      '2026-12-28',
    ])
  })

  it('диапазон без уроков даёт пустой список, исходный не меняется', () => {
    const copy = [...COLUMNS]
    expect(filterColumnsByRange(COLUMNS, { start: '2026-11-20', end: '2026-11-25' })).toEqual([])
    expect(COLUMNS).toEqual(copy)
  })

  it('порядок колонок сохраняется', () => {
    expect(filterColumnsByRange(COLUMNS, { start: '2026-11-03', end: '2026-12-01' })).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-10',
      '2026-11-11',
      '2026-12-01',
    ])
  })
})

describe('clampRange', () => {
  it('без выбора — вся четверть', () => {
    expect(clampRange(null, TERM2)).toEqual(TERM2)
  })

  it('выбор внутри четверти не меняется', () => {
    const r = { start: '2026-11-10', end: '2026-11-20' }
    expect(clampRange(r, TERM2)).toEqual(r)
  })

  it('диапазон не выходит за границы четверти', () => {
    expect(clampRange({ start: '2026-10-01', end: '2027-02-01' }, TERM2)).toEqual(TERM2)
    expect(clampRange({ start: '2026-10-20', end: '2026-11-15' }, TERM2)).toEqual({
      start: '2026-11-02',
      end: '2026-11-15',
    })
    expect(clampRange({ start: '2026-12-10', end: '2027-01-30' }, TERM2)).toEqual({
      start: '2026-12-10',
      end: '2026-12-28',
    })
  })

  it('диапазон целиком вне четверти — показываем всю четверть', () => {
    expect(clampRange({ start: '2027-01-12', end: '2027-01-20' }, TERM2)).toEqual(TERM2)
    expect(clampRange({ start: '2026-09-01', end: '2026-09-10' }, TERM2)).toEqual(TERM2)
  })

  it('перепутанные «с» и «по» меняются местами', () => {
    expect(clampRange({ start: '2026-11-20', end: '2026-11-10' }, TERM2)).toEqual({
      start: '2026-11-10',
      end: '2026-11-20',
    })
  })
})

describe('storeRange / isNarrowed', () => {
  it('выбор всей четверти — то же самое, что «без выбора»', () => {
    expect(storeRange(TERM2, TERM2)).toBeNull()
    expect(storeRange(null, TERM2)).toBeNull()
    expect(storeRange({ start: '2026-10-01', end: '2027-01-01' }, TERM2)).toBeNull()
  })

  it('сужение запоминается вместе с границами четверти', () => {
    const r = { start: '2026-11-10', end: '2026-11-20' }
    expect(storeRange(r, TERM2)).toEqual({ bounds: TERM2, range: r })
  })

  it('isNarrowed: только когда диапазон уже четверти', () => {
    expect(isNarrowed(TERM2, TERM2)).toBe(false)
    expect(isNarrowed({ start: '2026-11-10', end: TERM2.end }, TERM2)).toBe(true)
    expect(isNarrowed({ start: TERM2.start, end: '2026-12-01' }, TERM2)).toBe(true)
  })
})

describe('resolveRange: сброс при смене четверти', () => {
  const picked = storeRange({ start: '2026-11-10', end: '2026-11-20' }, TERM2)

  it('в той же четверти выбранный диапазон действует', () => {
    expect(resolveRange(picked, TERM2)).toEqual({ start: '2026-11-10', end: '2026-11-20' })
  })

  it('при смене четверти возвращается вся новая четверть', () => {
    expect(resolveRange(picked, TERM3)).toEqual(TERM3)
  })

  it('без выбора — вся четверть', () => {
    expect(resolveRange(null, TERM2)).toEqual(TERM2)
  })

  it('чужой выбор не просачивается в новую четверть даже при пересечении дат', () => {
    const overlapping: DateRange = { start: '2026-11-20', end: '2027-02-01' }
    const stored = storeRange({ start: '2026-11-25', end: '2026-12-10' }, TERM2)
    // новая четверть захватывает даты выбора, но это другая четверть
    expect(resolveRange(stored, overlapping)).toEqual(overlapping)
  })

  it('после сужения колонки реально уменьшаются, после смены четверти — нет', () => {
    const narrowedCols = filterColumnsByRange(COLUMNS, resolveRange(picked, TERM2))
    expect(narrowedCols).toEqual(['2026-11-10', '2026-11-11'])
    const term3Cols = ['2027-01-11', '2027-01-12', '2027-02-15']
    expect(filterColumnsByRange(term3Cols, resolveRange(picked, TERM3))).toEqual(term3Cols)
  })
})

describe('extendToInclude: урок добавлен вручную', () => {
  const range = { start: '2026-11-10', end: '2026-11-20' }

  it('дата внутри диапазона — ничего не меняется', () => {
    expect(extendToInclude(range, TERM2, '2026-11-15')).toEqual(range)
  })

  it('дата до диапазона сдвигает начало', () => {
    expect(extendToInclude(range, TERM2, '2026-11-05')).toEqual({
      start: '2026-11-05',
      end: '2026-11-20',
    })
  })

  it('дата после диапазона сдвигает конец', () => {
    expect(extendToInclude(range, TERM2, '2026-12-05')).toEqual({
      start: '2026-11-10',
      end: '2026-12-05',
    })
  })

  it('дата вне четверти диапазон не расширяет (колонка всё равно не показывается)', () => {
    expect(extendToInclude(range, TERM2, '2027-01-12')).toEqual(range)
    expect(extendToInclude(range, TERM2, '2026-10-01')).toEqual(range)
  })

  it('расширение до границ четверти превращается в «без выбора»', () => {
    const wide = extendToInclude(
      extendToInclude(range, TERM2, TERM2.start),
      TERM2,
      TERM2.end,
    )
    expect(storeRange(wide, TERM2)).toBeNull()
  })
})
