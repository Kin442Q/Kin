import { GRADE_THRESHOLDS } from '../ministry/ministry.service'
import { FEATURES } from '../features/feature-registry'
import { DEFAULT_THRESHOLDS, thresholdsFor } from './verdict-scale'
import {
  addDays, eachDay, isMonth, monthEnd, monthStart, previousMonth, schoolToday, weekdayOf,
} from './verdict-dates'

describe('Пороги по шкалам', () => {
  it('значения по умолчанию совпадают с предложением владельца для шкалы 5', () => {
    expect(DEFAULT_THRESHOLDS.FIVE).toMatchObject({
      scaleMax: 5, weakAverage: 3.5, badMark: 2, badMarksInRow: 2, dropBy: 0.5, strongAverage: 4.7,
      noGradesDays: 21, homeworkNotDoneShare: 0.3, absenceMinLessons: 3,
    })
  })

  it.each(['FIVE', 'TEN'] as const)('шкала %s согласована с ведомственной статистикой (3↔4, 4↔7, 5↔10)', (scale) => {
    const t = DEFAULT_THRESHOLDS[scale]
    const m = GRADE_THRESHOLDS[scale]
    expect(t.scaleMax).toBe(m.max)
    // «плохая» оценка — ниже порога «удовлетворительно»: иначе школа «слабая» для родителя и «нормальная» для министерства
    expect(t.badMark).toBe(m.pass - 1)
    // слабый предмет — между «удовлетворительно» и «хорошо»; сильный — между «хорошо» и максимумом
    expect(t.weakAverage).toBeGreaterThan(m.pass)
    expect(t.weakAverage).toBeLessThan(m.good)
    expect(t.strongAverage).toBeGreaterThan(m.good)
    expect(t.strongAverage).toBeLessThan(m.max)
    // падение — около десятой части шкалы
    expect(t.dropBy / m.max).toBeCloseTo(0.1, 5)
  })

  it('пороги, не зависящие от шкалы, одинаковы', () => {
    const { FIVE, TEN } = DEFAULT_THRESHOLDS
    for (const key of [
      'badMarksInRow', 'weakMinGrades', 'dropMinGrades', 'strongMinGrades', 'noGradesDays', 'noGradesMinLessons',
      'noGradesMaxAbsentShare', 'homeworkNotDoneShare', 'homeworkMinAssessed', 'homeworkMinMarkedShare', 'absenceMinLessons',
    ] as const) {
      expect(TEN[key]).toBe(FIVE[key])
    }
  })

  it('переопределение школы меняет порог, но не шкалу', () => {
    const t = thresholdsFor('TEN', { weakAverage: 6, absenceMinLessons: 4 })
    expect(t.weakAverage).toBe(6)
    expect(t.absenceMinLessons).toBe(4)
    expect(t.scaleMax).toBe(10)
    expect(t.dropBy).toBe(1)
    // исходная таблица не испорчена
    expect(DEFAULT_THRESHOLDS.TEN.weakAverage).toBe(5.5)
  })
})

describe('Раздел parent_verdict', () => {
  it('по умолчанию выключен: включаем школам вручную (пилот)', () => {
    expect(FEATURES.parent_verdict.defaultEnabled).toBe(false)
  })
})

describe('Даты вердикта', () => {
  it('месяц: формат, начало, конец, предыдущий', () => {
    expect(isMonth('2026-10')).toBe(true)
    for (const bad of ['2026-13', '2026-1', '2026-00', '26-10', '2026-10-01', '']) expect(isMonth(bad)).toBe(false)
    expect(monthStart('2026-10')).toBe('2026-10-01')
    expect(monthEnd('2026-10')).toBe('2026-10-31')
    expect(monthEnd('2026-02')).toBe('2026-02-28')
    expect(monthEnd('2028-02')).toBe('2028-02-29')
    expect(previousMonth('2026-10')).toBe('2026-09')
    expect(previousMonth('2026-01')).toBe('2025-12')
  })

  it('дни: сдвиг, перечисление, день недели (1 = понедельник, 7 = воскресенье)', () => {
    expect(addDays('2026-10-31', -20)).toBe('2026-10-11')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(eachDay('2026-10-02', '2026-10-01')).toEqual([])
    expect(weekdayOf('2026-10-05')).toBe(1)
    expect(weekdayOf('2026-10-11')).toBe(7)
    expect(weekdayOf('2026-10-31')).toBe(6)
  })

  it('«сегодня» — по времени Душанбе (UTC+5), а не сервера', () => {
    expect(schoolToday(new Date('2026-10-31T19:30:00Z'))).toBe('2026-11-01')
    expect(schoolToday(new Date('2026-10-31T18:59:00Z'))).toBe('2026-10-31')
  })
})
