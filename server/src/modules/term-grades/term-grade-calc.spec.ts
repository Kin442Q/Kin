import { calculateTermGrade, resolveTermGrade, roundHalfUp } from './term-grade-calc'

const d = (iso: string) => new Date(iso)
const marks = (...values: number[]) => values.map((value, i) => ({ value, date: d(`2026-11-${String(i + 1).padStart(2, '0')}`) }))

describe('расчёт итога четверти', () => {
  describe('округление «половина — вверх»', () => {
    it.each([
      [[4, 5], 5], // 4,5 → 5
      [[3, 4], 4], // 3,5 → 4
      [[2, 3], 3], // 2,5 → 3 (не «банковское» округление к чётному)
      [[3, 3, 4], 3], // 3,33 → 3
      [[3, 4, 4], 4], // 3,67 → 4
      [[5], 5],
      [[1, 1, 1], 1],
    ])('оценки %j → %i', (values, expected) => {
      expect(calculateTermGrade(marks(...values), 5).value).toBe(expected)
    })

    it('чуть меньше половины округляется вниз, ровно половина — вверх', () => {
      // 49 пятёрок и 51 четвёрка: 4,49
      expect(roundHalfUp(49 * 5 + 51 * 4, 100)).toBe(4)
      expect(roundHalfUp(50 * 5 + 50 * 4, 100)).toBe(5)
      // большие суммы не дают ошибок дробной арифметики
      expect(roundHalfUp(7 * 1001, 2002)).toBe(4)
    })
  })

  it('средний балл с двумя знаками, число оценок и дата последней оценки', () => {
    const grades = [
      { value: 4, date: d('2026-11-20') },
      { value: 3, date: d('2026-11-03') },
      { value: 4, date: d('2026-11-10') },
    ]
    expect(calculateTermGrade(grades, 5)).toEqual({
      value: 4,
      average: 3.67,
      count: 3,
      asOf: '2026-11-20',
      reason: null,
    })
  })

  it('без оценок итога нет', () => {
    expect(calculateTermGrade([], 5)).toEqual({ value: null, average: null, count: 0, asOf: null, reason: 'NO_GRADES' })
  })

  describe('шкала школы', () => {
    it('десятибалльная: 7 и 8 → 8; максимум 10 допустим', () => {
      expect(calculateTermGrade(marks(7, 8), 10).value).toBe(8)
      expect(calculateTermGrade(marks(10, 10), 10).value).toBe(10)
    })

    it('оценка выше шкалы (8 в пятибалльной школе): итог не считаем, а не «подрезаем»', () => {
      expect(calculateTermGrade(marks(5, 8), 5)).toMatchObject({
        value: null,
        average: null,
        count: 2,
        reason: 'OUT_OF_SCALE',
      })
    })

    it('оценка меньше 1 (мусор в базе) тоже блокирует расчёт', () => {
      expect(calculateTermGrade(marks(0, 5), 5).reason).toBe('OUT_OF_SCALE')
    })
  })
})

describe('что действует: учитель или расчёт', () => {
  const manual = { value: 5, setAt: d('2026-11-25T10:00:00Z'), setBy: { id: 't1', fullName: 'Мария' } }

  it('оценка учителя главнее расчёта, расчёт остаётся для справки', () => {
    const view = resolveTermGrade(manual, calculateTermGrade(marks(2, 3), 5))
    expect(view).toMatchObject({ value: 5, source: 'TEACHER', date: '2026-11-25T10:00:00.000Z' })
    expect(view.manual).toEqual({ value: 5, setAt: '2026-11-25T10:00:00.000Z', setBy: { id: 't1', fullName: 'Мария' } })
    expect(view.calculated).toMatchObject({ value: 3, average: 2.5 })
  })

  it('новые оценки меняют расчёт, но не оценку учителя', () => {
    const before = resolveTermGrade(manual, calculateTermGrade(marks(5, 5), 5))
    const after = resolveTermGrade(manual, calculateTermGrade(marks(5, 5, 2, 2, 2, 2), 5))
    expect(before.calculated.value).toBe(5)
    expect(after.calculated.value).toBe(3)
    expect(after.value).toBe(5)
    expect(after.source).toBe('TEACHER')
  })

  it('оценка учителя действует и без обычных оценок, и при оценках вне шкалы', () => {
    expect(resolveTermGrade(manual, calculateTermGrade([], 5))).toMatchObject({ value: 5, source: 'TEACHER' })
    expect(resolveTermGrade(manual, calculateTermGrade(marks(9), 5))).toMatchObject({ value: 5, source: 'TEACHER' })
  })

  it('без оценки учителя действует расчёт, дата — по какие оценки посчитано', () => {
    expect(resolveTermGrade(null, calculateTermGrade(marks(4, 5, 5), 5))).toMatchObject({
      value: 5,
      source: 'SYSTEM',
      date: '2026-11-03',
      manual: null,
    })
  })

  it('нет ни того, ни другого — итога нет, источника тоже', () => {
    expect(resolveTermGrade(undefined, calculateTermGrade([], 5))).toMatchObject({ value: null, source: null, date: null })
  })
})
