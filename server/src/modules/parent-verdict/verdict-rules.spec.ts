import {
  computeVerdictSignals,
  pickFocus,
  type RulesInput,
  type Signal,
  type StudentResult,
  type SubjectResult,
} from './verdict-rules'
import { thresholdsFor, type VerdictScale } from './verdict-scale'

/**
 * Календарь теста: 2026-10-01 — четверг; 2026-10-05 — понедельник; 2026-10-31 — суббота.
 * Окно «нет оценок» (21 день) при asOf = 31 октября — с 11 октября (воскресенье): три учебные недели
 * 12–16, 19–23, 26–30 октября.
 */
const MONTH = '2026-10'
const ASOF = '2026-10-31'

function base(over: Partial<RulesInput> = {}, scale: VerdictScale = 'FIVE'): RulesInput {
  return {
    month: MONTH,
    asOf: ASOF,
    scale,
    thresholds: thresholdsFor(scale),
    subjects: [
      { id: 'math', name: 'Математика' },
      { id: 'hist', name: 'История' },
      { id: 'rus', name: 'Русский язык' },
    ],
    students: [{ id: 'a' }],
    grades: [],
    attendance: [],
    schedule: [],
    terms: [],
    homework: [],
    sections: { attendance: true, schedule: true, homework: true },
    ...over,
  }
}

const day = (month: string, d: number) => `${month}-${String(d).padStart(2, '0')}`

/** Оценки подряд по дням месяца: first, first+1, … */
function grades(studentId: string, subjectId: string, values: number[], month: string, first = 1) {
  return values.map((value, i) => ({ studentId, subjectId, value, date: day(month, first + i) }))
}

const rep = (value: number, times: number) => new Array<number>(times).fill(value)

const run = (over: Partial<RulesInput> = {}, scale: VerdictScale = 'FIVE') => computeVerdictSignals(base(over, scale))
const first = (r: ReturnType<typeof computeVerdictSignals>) => r.students[0]
const subjectOf = (r: StudentResult, id: string) => r.subjects.find((s) => s.subjectId === id)
const codesOf = (r: StudentResult, id: string) => subjectOf(r, id)?.signals.map((s) => s.code) ?? []
const signalOf = <C extends Signal['code']>(r: StudentResult, id: string, code: C) =>
  subjectOf(r, id)?.signals.find((s): s is Extract<Signal, { code: C }> => s.code === code)

describe('Слабый предмет', () => {
  it('средний ниже 3,5 — сигнал с цифрами', () => {
    const r = first(run({ grades: grades('a', 'math', [3, 3, 4, 3, 4], '2026-10') }))
    expect(signalOf(r, 'math', 'WEAK')).toEqual({
      code: 'WEAK', subjectId: 'math', average: 3.4, gradesCount: 5, reasons: ['AVERAGE'],
    })
  })

  it('ровно 3,5 — не слабый', () => {
    const r = first(run({ grades: grades('a', 'math', [3, 4], '2026-10') }))
    expect(codesOf(r, 'math')).not.toContain('WEAK')
  })

  it('3,45 округляется до 3,5 и не считается слабым: цифра в тексте и условие совпадают', () => {
    // девять «4» и одиннадцать «3»: 69 / 20 = 3,45
    const values = [...rep(4, 9), ...rep(3, 11)]
    const r = first(run({ grades: grades('a', 'math', values, '2026-10') }))
    expect(subjectOf(r, 'math')?.average).toBe(3.5)
    expect(codesOf(r, 'math')).not.toContain('WEAK')
  })

  it('две «2» подряд — сигнал, даже если средний нормальный', () => {
    const r = first(run({ grades: grades('a', 'math', [2, 2, 5, 5, 5], '2026-10') }))
    expect(signalOf(r, 'math', 'WEAK')?.reasons).toEqual(['BAD_MARKS_IN_ROW'])
  })

  it('«2» не подряд и средний ровно 3,5 — нет сигнала', () => {
    const r = first(run({ grades: grades('a', 'math', [2, 5, 2, 5], '2026-10') }))
    expect(codesOf(r, 'math')).not.toContain('WEAK')
  })

  it('«подряд» считается по датам, а не по порядку в данных', () => {
    const r = first(run({
      grades: [
        { studentId: 'a', subjectId: 'math', value: 2, date: '2026-10-11' },
        { studentId: 'a', subjectId: 'math', value: 5, date: '2026-10-03' },
        { studentId: 'a', subjectId: 'math', value: 2, date: '2026-10-10' },
      ],
    }))
    expect(signalOf(r, 'math', 'WEAK')?.reasons).toContain('BAD_MARKS_IN_ROW')
  })

  it('одна оценка — мало данных, сигнала нет даже при «2»', () => {
    const r = first(run({ grades: grades('a', 'math', [2], '2026-10') }))
    expect(codesOf(r, 'math')).toEqual([])
  })

  it('обе причины сразу', () => {
    const r = first(run({ grades: grades('a', 'math', [2, 2, 3], '2026-10') }))
    expect(signalOf(r, 'math', 'WEAK')?.reasons).toEqual(['AVERAGE', 'BAD_MARKS_IN_ROW'])
  })

  it('шкала 10: средний 5,4 — слабый, 5,5 — нет', () => {
    const weak = first(run({ grades: grades('a', 'math', [5, 5, 6, 5, 6, 5, 6, 5, 6, 5], '2026-10') }, 'TEN'))
    expect(subjectOf(weak, 'math')?.average).toBe(5.4)
    expect(codesOf(weak, 'math')).toContain('WEAK')
    const ok = first(run({ grades: grades('a', 'math', [5, 6], '2026-10') }, 'TEN'))
    expect(codesOf(ok, 'math')).not.toContain('WEAK')
  })

  it('шкала 10: «плохая» оценка — 3 и ниже; 4 — это уже «удовлетворительно»', () => {
    const bad = first(run({ grades: grades('a', 'math', [3, 3, 9, 9, 9], '2026-10') }, 'TEN'))
    expect(signalOf(bad, 'math', 'WEAK')?.reasons).toEqual(['BAD_MARKS_IN_ROW'])
    const pass = first(run({ grades: grades('a', 'math', [4, 4, 9, 9, 9], '2026-10') }, 'TEN'))
    expect(codesOf(pass, 'math')).not.toContain('WEAK')
  })
})

describe('Падение', () => {
  it('с 4,5 до 3,9 — сигнал', () => {
    const r = first(run({
      grades: [...grades('a', 'math', [4, 5], '2026-09'), ...grades('a', 'math', [...rep(4, 9), 3], '2026-10')],
    }))
    expect(signalOf(r, 'math', 'DROP')).toEqual({ code: 'DROP', subjectId: 'math', from: 4.5, to: 3.9 })
  })

  it('ровно на 0,5 — сигнал', () => {
    const r = first(run({ grades: [...grades('a', 'math', [4, 5], '2026-09'), ...grades('a', 'math', [4, 4], '2026-10')] }))
    expect(codesOf(r, 'math')).toContain('DROP')
  })

  it('на 0,4 — нет сигнала', () => {
    // сентябрь 4,5; октябрь 4,1 (десять оценок, сумма 41)
    const r = first(run({
      grades: [...grades('a', 'math', [4, 5], '2026-09'), ...grades('a', 'math', [...rep(4, 9), 5], '2026-10')],
    }))
    expect(subjectOf(r, 'math')?.average).toBe(4.1)
    expect(codesOf(r, 'math')).not.toContain('DROP')
  })

  it('граница без ошибок плавающей точки: 4,1 → 3,6 это ровно 0,5', () => {
    // в числах с плавающей точкой 4,1 - 3,6 = 0,4999999999999996
    const sept = grades('a', 'math', [...rep(4, 9), 5], '2026-09')
    const oct = grades('a', 'math', [...rep(4, 6), ...rep(3, 4)], '2026-10')
    const r = first(run({ grades: [...sept, ...oct] }))
    expect(signalOf(r, 'math', 'DROP')).toMatchObject({ from: 4.1, to: 3.6 })
  })

  it('в прошлом месяце одна оценка — сравнивать не с чем', () => {
    const r = first(run({ grades: [...grades('a', 'math', [5], '2026-09'), ...grades('a', 'math', [3, 3], '2026-10')] }))
    expect(codesOf(r, 'math')).not.toContain('DROP')
  })

  it('рост — не падение', () => {
    const r = first(run({ grades: [...grades('a', 'math', [3, 3], '2026-09'), ...grades('a', 'math', [5, 5], '2026-10')] }))
    expect(codesOf(r, 'math')).not.toContain('DROP')
  })

  it('шкала 10: падение на 1,0 — сигнал, на 0,9 — нет', () => {
    const sept = grades('a', 'math', [8, 8], '2026-09')
    const drop = first(run({ grades: [...sept, ...grades('a', 'math', [7, 7], '2026-10')] }, 'TEN'))
    expect(codesOf(drop, 'math')).toContain('DROP')
    const small = first(run({ grades: [...sept, ...grades('a', 'math', [...rep(7, 1), ...rep(8, 9)], '2026-10')] }, 'TEN'))
    expect(subjectOf(small, 'math')?.average).toBe(7.9)
    expect(codesOf(small, 'math')).not.toContain('DROP')
  })
})

describe('Сильный предмет', () => {
  it('4,7 и выше два месяца подряд — похвала', () => {
    const r = first(run({ grades: [...grades('a', 'math', [5, 5, 5], '2026-09'), ...grades('a', 'math', [5, 5, 5], '2026-10')] }))
    expect(signalOf(r, 'math', 'STRONG')).toEqual({ code: 'STRONG', subjectId: 'math', average: 5, previousAverage: 5 })
  })

  it('ровно 4,7 — подходит, 4,6 — нет', () => {
    const at = [...rep(5, 7), ...rep(4, 3)]
    const below = [...rep(5, 6), ...rep(4, 4)]
    const yes = first(run({ grades: [...grades('a', 'math', at, '2026-09'), ...grades('a', 'math', at, '2026-10')] }))
    expect(codesOf(yes, 'math')).toContain('STRONG')
    const no = first(run({ grades: [...grades('a', 'math', at, '2026-09'), ...grades('a', 'math', below, '2026-10')] }))
    expect(codesOf(no, 'math')).not.toContain('STRONG')
  })

  it('только один месяц или меньше трёх оценок — не хвалим', () => {
    const one = first(run({ grades: grades('a', 'math', [5, 5, 5], '2026-10') }))
    expect(codesOf(one, 'math')).not.toContain('STRONG')
    const few = first(run({ grades: [...grades('a', 'math', [5, 5], '2026-09'), ...grades('a', 'math', [5, 5], '2026-10')] }))
    expect(codesOf(few, 'math')).not.toContain('STRONG')
  })

  it('шкала 10: 9,1 — подходит, 9,0 — нет', () => {
    const at = [...rep(10, 1), ...rep(9, 9)] // 91 / 10 = 9,1
    const below = rep(9, 10)
    const yes = first(run({ grades: [...grades('a', 'math', at, '2026-09'), ...grades('a', 'math', at, '2026-10')] }, 'TEN'))
    expect(codesOf(yes, 'math')).toContain('STRONG')
    const no = first(run({ grades: [...grades('a', 'math', below, '2026-09'), ...grades('a', 'math', below, '2026-10')] }, 'TEN'))
    expect(codesOf(no, 'math')).not.toContain('STRONG')
  })
})

describe('Домашние задания', () => {
  const students = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  const homework = (
    count: number,
    statusOf: (i: number) => string | null,
    opts: { subjectId?: string; classMarked?: boolean } = {},
  ) =>
    Array.from({ length: count }, (_, i) => {
      const submissions: { studentId: string; status: string }[] = []
      const mine = statusOf(i)
      if (mine) submissions.push({ studentId: 'a', status: mine })
      // учитель отметил ещё двоих — вместе с «a» это больше половины класса из четырёх, а без него — ровно половина
      if (opts.classMarked !== false) {
        submissions.push({ studentId: 'b', status: 'DONE' }, { studentId: 'c', status: 'DONE' })
      }
      return { id: `hw${i}`, subjectId: opts.subjectId ?? 'math', dueDate: day(MONTH, i + 1), submissions }
    })

  it('4 из 10 не сдано — сигнал', () => {
    const r = first(run({ students, homework: homework(10, (i) => (i < 4 ? 'NOT_DONE' : 'DONE')) }))
    expect(signalOf(r, 'math', 'HOMEWORK')).toEqual({ code: 'HOMEWORK', subjectId: 'math', notDone: 4, assessed: 10 })
  })

  it('ровно 30% — сигнал, 20% — нет', () => {
    const at = first(run({ students, homework: homework(10, (i) => (i < 3 ? 'NOT_DONE' : 'DONE')) }))
    expect(codesOf(at, 'math')).toContain('HOMEWORK')
    const below = first(run({ students, homework: homework(10, (i) => (i < 2 ? 'NOT_DONE' : 'DONE')) }))
    expect(codesOf(below, 'math')).not.toContain('HOMEWORK')
  })

  it('меньше трёх проверенных заданий — мало данных', () => {
    const r = first(run({ students, homework: homework(2, () => 'NOT_DONE') }))
    expect(codesOf(r, 'math')).not.toContain('HOMEWORK')
  })

  it('«ещё не отмечено» не равно «не сдано»: задания без отметки ученику не считаются', () => {
    // у ученика отметки есть только по двум из пяти заданий
    const r = first(run({ students, homework: homework(5, (i) => (i < 2 ? 'NOT_DONE' : null)) }))
    expect(codesOf(r, 'math')).not.toContain('HOMEWORK')
  })

  it('задание, которое учитель почти не проверял (меньше половины класса), не учитывается', () => {
    const r = first(run({ students, homework: homework(10, () => 'NOT_DONE', { classMarked: false }) }))
    expect(codesOf(r, 'math')).not.toContain('HOMEWORK')
  })

  it('«выполнено частично» и «сам отметил» не считаются несданными', () => {
    const r = first(run({
      students,
      homework: homework(10, (i) => (i < 3 ? 'NOT_DONE' : i < 6 ? 'PARTIAL' : 'SUBMITTED')),
    }))
    expect(signalOf(r, 'math', 'HOMEWORK')).toMatchObject({ notDone: 3, assessed: 10 })
  })

  it('задания других месяцев и будущие не считаются', () => {
    const hw = homework(10, () => 'NOT_DONE').map((item, i) => ({ ...item, dueDate: i < 5 ? day('2026-09', i + 1) : '2026-11-05' }))
    const r = first(run({ students, homework: hw }))
    expect(codesOf(r, 'math')).not.toContain('HOMEWORK')
  })

  it('раздел «Домашние задания» выключен — сигнала нет', () => {
    const r = first(run({
      students,
      homework: homework(10, () => 'NOT_DONE'),
      sections: { attendance: true, schedule: true, homework: false },
    }))
    expect(codesOf(r, 'math')).not.toContain('HOMEWORK')
  })
})

describe('Пропуски по предмету', () => {
  const mathMonWed = [
    { subjectId: 'math', dayOfWeek: 1 },
    { subjectId: 'math', dayOfWeek: 3 },
  ]
  const att = (days: string[], status: 'ABSENT' | 'SICK' | 'VACATION' | 'PRESENT' = 'ABSENT') =>
    days.map((date) => ({ studentId: 'a', date, status }))

  it('3 пропущенных урока предмета — сигнал', () => {
    // 5 и 12 октября — понедельники, 7 октября — среда
    const r = first(run({ schedule: mathMonWed, attendance: att(['2026-10-05', '2026-10-07', '2026-10-12']) }))
    expect(signalOf(r, 'math', 'ABSENCES')).toEqual({ code: 'ABSENCES', subjectId: 'math', lessons: 3, days: 3 })
  })

  it('2 урока — ещё не сигнал', () => {
    const r = first(run({ schedule: mathMonWed, attendance: att(['2026-10-05', '2026-10-07']) }))
    expect(codesOf(r, 'math')).not.toContain('ABSENCES')
  })

  it('болезнь и отпуск не считаются пропусками', () => {
    const days = ['2026-10-05', '2026-10-07', '2026-10-12']
    expect(codesOf(first(run({ schedule: mathMonWed, attendance: att(days, 'SICK') })), 'math')).not.toContain('ABSENCES')
    expect(codesOf(first(run({ schedule: mathMonWed, attendance: att(days, 'VACATION') })), 'math')).not.toContain('ABSENCES')
  })

  it('в день, когда предмета нет в расписании, пропуск этому предмету не засчитывается', () => {
    // вторники: 6, 13, 20 октября
    const r = first(run({ schedule: mathMonWed, attendance: att(['2026-10-06', '2026-10-13', '2026-10-20']) }))
    expect(codesOf(r, 'math')).not.toContain('ABSENCES')
  })

  it('сдвоенный урок считается за два', () => {
    const schedule = [...mathMonWed, { subjectId: 'math', dayOfWeek: 1 }]
    const r = first(run({ schedule, attendance: att(['2026-10-05', '2026-10-07']) }))
    expect(signalOf(r, 'math', 'ABSENCES')).toMatchObject({ lessons: 3, days: 2 })
  })

  it('дни вне учебной четверти (каникулы) не считаются', () => {
    const terms = [{ startDate: '2026-10-01', endDate: '2026-10-09' }]
    const r = first(run({ terms, schedule: mathMonWed, attendance: att(['2026-10-05', '2026-10-07', '2026-10-12']) }))
    expect(codesOf(r, 'math')).not.toContain('ABSENCES')
  })

  it('нет расписания или посещаемости — сигнала нет', () => {
    const days = ['2026-10-05', '2026-10-07', '2026-10-12']
    expect(codesOf(first(run({ attendance: att(days) })), 'math')).not.toContain('ABSENCES')
    const off = first(run({
      schedule: mathMonWed, attendance: att(days),
      sections: { attendance: false, schedule: true, homework: true },
    }))
    expect(codesOf(off, 'math')).not.toContain('ABSENCES')
  })
})

describe('Нет оценок', () => {
  const mathMonWedFri = [1, 3, 5].map((dayOfWeek) => ({ subjectId: 'math', dayOfWeek }))
  const twoStudents = [{ id: 'a' }, { id: 'b' }]
  const att = (studentId: string, days: string[], status: 'ABSENT' | 'SICK' = 'ABSENT') =>
    days.map((date) => ({ studentId, date, status }))
  /** Учебные дни окна: 12–16, 19–23, 26–30 октября. */
  const schoolDays = [12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30].map((d) => day(MONTH, d))

  it('у ребёнка нет оценок, у других в классе есть — сигнал «student» с числом уроков', () => {
    const r = run({
      students: twoStudents,
      schedule: mathMonWedFri,
      grades: [{ studentId: 'b', subjectId: 'math', value: 5, date: '2026-10-20' }],
    })
    expect(r.window).toEqual({ from: '2026-10-11', to: '2026-10-31' })
    expect(signalOf(r.students[0], 'math', 'NO_GRADES')).toEqual({
      code: 'NO_GRADES', subjectId: 'math', scope: 'student', lessons: 9, days: 21,
    })
    expect(codesOf(r.students[1], 'math')).not.toContain('NO_GRADES')
  })

  it('оценка за день до окна не спасает: окно начинается 11 октября', () => {
    const r = run({
      students: twoStudents,
      schedule: mathMonWedFri,
      grades: [
        { studentId: 'a', subjectId: 'math', value: 5, date: '2026-10-10' },
        { studentId: 'b', subjectId: 'math', value: 5, date: '2026-10-20' },
      ],
    })
    expect(codesOf(r.students[0], 'math')).toContain('NO_GRADES')
  })

  it('по предмету не ставят никому в классе — сигнал «class»; в акцент ребёнка он не входит', () => {
    const r = run({
      students: twoStudents,
      schedule: mathMonWedFri,
      grades: [{ studentId: 'b', subjectId: 'hist', value: 5, date: '2026-10-15' }],
    })
    expect(signalOf(r.students[0], 'math', 'NO_GRADES')).toMatchObject({ scope: 'class' })
    expect(signalOf(r.students[1], 'math', 'NO_GRADES')).toMatchObject({ scope: 'class' })
    expect(r.students[0].focus).toBeNull()
  })

  it('в классе за окно вообще нет оценок (каникулы или журнал не ведут) — молчим', () => {
    const r = run({ students: twoStudents, schedule: mathMonWedFri })
    expect(r.journalSilent).toBe(true)
    expect(r.students.every((s) => s.subjects.every((subj) => !subj.signals.length))).toBe(true)
  })

  it('мало уроков в окне — нет сигнала; ровно 3 урока — есть', () => {
    const mondays = [{ subjectId: 'math', dayOfWeek: 1 }] // 12, 19, 26 октября
    const others = [{ studentId: 'b', subjectId: 'hist', value: 5, date: '2026-10-15' }]
    const three = run({ students: twoStudents, schedule: mondays, grades: others })
    expect(signalOf(three.students[0], 'math', 'NO_GRADES')).toMatchObject({ lessons: 3 })
    // четверть началась 20 октября: до неё каникулы, в окне остаётся один понедельник
    const terms = [{ startDate: '2026-10-20', endDate: '2026-12-25' }]
    const one = run({ students: twoStudents, schedule: mondays, grades: others, terms })
    expect(codesOf(one.students[0], 'math')).not.toContain('NO_GRADES')
  })

  it('уроки, пропущенные ребёнком, не считаются: был на двух из трёх — мало', () => {
    const mondays = [{ subjectId: 'math', dayOfWeek: 1 }]
    const others = [{ studentId: 'b', subjectId: 'hist', value: 5, date: '2026-10-15' }]
    const absent = run({ students: twoStudents, schedule: mondays, grades: others, attendance: att('a', ['2026-10-12']) })
    expect(codesOf(absent.students[0], 'math')).not.toContain('NO_GRADES')
    // посещаемость выключена — об отсутствии ничего не знаем, считаем все уроки
    const off = run({
      students: twoStudents, schedule: mondays, grades: others, attendance: att('a', ['2026-10-12']),
      sections: { attendance: false, schedule: true, homework: true },
    })
    expect(codesOf(off.students[0], 'math')).toContain('NO_GRADES')
  })

  it('ребёнок не был больше половины учебных дней окна (болел) — не обвиняем журнал и учителя', () => {
    const everyDay = [1, 2, 3, 4, 5].map((dayOfWeek) => ({ subjectId: 'math', dayOfWeek }))
    const others = [{ studentId: 'b', subjectId: 'hist', value: 5, date: '2026-10-15' }]
    // 8 из 15 дней — больше половины
    const mostly = run({ students: twoStudents, schedule: everyDay, grades: others, attendance: att('a', schoolDays.slice(0, 8), 'SICK') })
    expect(codesOf(mostly.students[0], 'math')).not.toContain('NO_GRADES')
    // 7 из 15 — меньше половины: остальные 8 дней уроки были
    const some = run({ students: twoStudents, schedule: everyDay, grades: others, attendance: att('a', schoolDays.slice(0, 7), 'SICK') })
    expect(signalOf(some.students[0], 'math', 'NO_GRADES')).toMatchObject({ lessons: 8 })
  })

  it('раздел «Расписание» выключен — сигнала нет', () => {
    const r = run({
      students: twoStudents,
      schedule: mathMonWedFri,
      grades: [{ studentId: 'b', subjectId: 'math', value: 5, date: '2026-10-20' }],
      sections: { attendance: true, schedule: false, homework: true },
    })
    expect(codesOf(r.students[0], 'math')).not.toContain('NO_GRADES')
  })
})

describe('Оценки вне шкалы', () => {
  it('на пятибалльной шкале оценка 7 блокирует ученика: вердикт по нему не строим', () => {
    const r = run({
      students: [{ id: 'a' }, { id: 'b' }],
      grades: [...grades('a', 'math', [7, 2, 2], '2026-10'), ...grades('b', 'math', [2, 2, 5], '2026-10')],
    })
    expect(r.students[0]).toEqual({
      studentId: 'a', blocked: { reason: 'GRADE_OUT_OF_SCALE', count: 1 }, subjects: [], focus: null,
    })
    expect(r.blockedStudents).toBe(1)
    // соседа это не касается
    expect(r.students[1].blocked).toBeNull()
    expect(codesOf(r.students[1], 'math')).toContain('WEAK')
  })

  it('оценка в прошлом месяце тоже блокирует (по ней считали бы падение)', () => {
    const r = run({ grades: [...grades('a', 'math', [8], '2026-09'), ...grades('a', 'math', [4, 4], '2026-10')] })
    expect(first(r).blocked).toMatchObject({ count: 1 })
  })

  it('ноль и отрицательные — тоже вне шкалы', () => {
    expect(first(run({ grades: grades('a', 'math', [0, 4], '2026-10') })).blocked).not.toBeNull()
  })

  it('на десятибалльной шкале 7 и 10 — обычные оценки', () => {
    const r = first(run({ grades: grades('a', 'math', [7, 10], '2026-10') }, 'TEN'))
    expect(r.blocked).toBeNull()
    expect(subjectOf(r, 'math')?.average).toBe(8.5)
  })
})

describe('Акцент месяца', () => {
  const sig = {
    weak: (id: string): Signal => ({ code: 'WEAK', subjectId: id, average: 3, gradesCount: 3, reasons: ['AVERAGE'] }),
    drop: (id: string): Signal => ({ code: 'DROP', subjectId: id, from: 4.5, to: 3.9 }),
    hw: (id: string): Signal => ({ code: 'HOMEWORK', subjectId: id, notDone: 4, assessed: 10 }),
    abs: (id: string): Signal => ({ code: 'ABSENCES', subjectId: id, lessons: 3, days: 3 }),
    none: (id: string, scope: 'student' | 'class' = 'student'): Signal => ({ code: 'NO_GRADES', subjectId: id, scope, lessons: 6, days: 21 }),
    strong: (id: string): Signal => ({ code: 'STRONG', subjectId: id, average: 5, previousAverage: 5 }),
  }
  const subj = (id: string, name: string, average: number | null, signals: Signal[]): SubjectResult => ({
    subjectId: id, subjectName: name, average, gradesCount: 3, previousAverage: null, previousGradesCount: 0, signals,
  })

  it('побеждает предмет с наибольшим числом проблемных сигналов', () => {
    const focus = pickFocus([
      subj('hist', 'История', null, [sig.none('hist')]),
      subj('math', 'Математика', 3.2, [sig.weak('math'), sig.hw('math')]),
    ])
    expect(focus?.subjectId).toBe('math')
    expect(focus?.signals.map((s) => s.code)).toEqual(['WEAK', 'HOMEWORK'])
  })

  it('при равенстве — приоритет сигналов: слабый > падение > ДЗ > пропуски > нет оценок', () => {
    const order = [sig.weak, sig.drop, sig.hw, sig.abs, sig.none]
    for (let i = 0; i < order.length - 1; i++) {
      const focus = pickFocus([
        subj('low', 'Б', 3, [order[i + 1]('low')]),
        subj('high', 'А', 3, [order[i]('high')]),
      ].reverse())
      expect(focus?.subjectId).toBe('high')
    }
  })

  it('при том же сигнале — ниже средний балл; предмет без оценок идёт последним', () => {
    expect(pickFocus([subj('a', 'Алгебра', 3.4, [sig.weak('a')]), subj('g', 'Геометрия', 3, [sig.weak('g')])])?.subjectId).toBe('g')
    expect(pickFocus([subj('n', 'Аа', null, [sig.hw('n')]), subj('m', 'Бб', 4.5, [sig.hw('m')])])?.subjectId).toBe('m')
  })

  it('при полном равенстве — по названию, как бы ни были упорядочены данные', () => {
    const list = [subj('g', 'Геометрия', 3, [sig.weak('g')]), subj('a', 'Алгебра', 3, [sig.weak('a')])]
    expect(pickFocus(list)?.subjectId).toBe('a')
    expect(pickFocus([...list].reverse())?.subjectId).toBe('a')
  })

  it('хвалебный сигнал и «нет оценок у всего класса» акцента не дают; проблем нет — акцента нет', () => {
    expect(pickFocus([subj('m', 'Математика', 5, [sig.strong('m')])])).toBeNull()
    expect(pickFocus([subj('h', 'История', null, [sig.none('h', 'class')])])).toBeNull()
    expect(pickFocus([subj('m', 'Математика', 4, [])])).toBeNull()
    expect(pickFocus([])).toBeNull()
  })

  it('похвала не мешает: у предмета и похвала, и проблема — считается одна проблема', () => {
    const focus = pickFocus([subj('m', 'Математика', 4, [sig.strong('m'), sig.hw('m')])])
    expect(focus?.signals).toEqual([sig.hw('m')])
  })

  it('сквозной случай: математика — слабый предмет и ДЗ, история — нет оценок', () => {
    const homework = Array.from({ length: 10 }, (_, i) => ({
      id: `hw${i}`, subjectId: 'math', dueDate: day(MONTH, i + 1),
      submissions: [{ studentId: 'a', status: i < 4 ? 'NOT_DONE' : 'DONE' }, { studentId: 'b', status: 'DONE' }],
    }))
    const r = run({
      students: [{ id: 'a' }, { id: 'b' }],
      grades: [...grades('a', 'math', [3, 3, 2, 3], '2026-10'), { studentId: 'b', subjectId: 'hist', value: 5, date: '2026-10-15' }],
      schedule: [1, 3, 5].flatMap((dayOfWeek) => [{ subjectId: 'math', dayOfWeek }, { subjectId: 'hist', dayOfWeek }]),
      homework,
    })
    const a = r.students[0]
    expect(codesOf(a, 'math')).toEqual(expect.arrayContaining(['WEAK', 'HOMEWORK']))
    expect(codesOf(a, 'hist')).toEqual(['NO_GRADES'])
    expect(a.focus?.subjectId).toBe('math')
  })
})

describe('Без рейтинга и сравнения с классом', () => {
  const keys = (value: unknown, out: Set<string> = new Set()): Set<string> => {
    if (Array.isArray(value)) value.forEach((v) => keys(v, out))
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        out.add(k)
        keys(v, out)
      }
    }
    return out
  }

  it('в результате нет ни места в классе, ни среднего по классу', () => {
    const r = run({
      students: [{ id: 'a' }, { id: 'b' }],
      grades: [...grades('a', 'math', [3, 3, 2], '2026-10'), ...grades('b', 'math', [5, 5, 5], '2026-10')],
    })
    const found = [...keys(r)].filter((k) => /rank|place|position|percentile|rating|class(avg|average)|classmate|top/i.test(k))
    expect(found).toEqual([])
  })

  it('оценки одноклассников не влияют на результат ребёнка', () => {
    const mine = grades('a', 'math', [3, 3, 2, 4], '2026-10')
    const scenario = (classmate: number) =>
      run({
        students: [{ id: 'a' }, { id: 'b' }],
        grades: [...mine, ...grades('b', 'math', rep(classmate, 6), '2026-10'), ...grades('b', 'math', rep(classmate, 4), '2026-09')],
      }).students[0]
    expect(scenario(5)).toEqual(scenario(2))
  })

  it('результат не зависит от порядка входных данных', () => {
    const input = base({
      students: [{ id: 'a' }, { id: 'b' }],
      grades: [
        ...grades('a', 'math', [3, 3, 2, 4], '2026-10'),
        ...grades('a', 'math', [5, 4], '2026-09'),
        ...grades('b', 'hist', [5, 5, 5], '2026-10', 12),
      ],
      schedule: [1, 3, 5].flatMap((dayOfWeek) => [{ subjectId: 'math', dayOfWeek }, { subjectId: 'hist', dayOfWeek }]),
      attendance: [{ studentId: 'a', date: '2026-10-05', status: 'ABSENT' }],
    })
    const shuffled: RulesInput = {
      ...input,
      students: [...input.students].reverse(),
      grades: [...input.grades].reverse(),
      schedule: [...input.schedule].reverse(),
    }
    const byId = (r: ReturnType<typeof computeVerdictSignals>) => Object.fromEntries(r.students.map((s) => [s.studentId, s]))
    expect(byId(computeVerdictSignals(shuffled))).toEqual(byId(computeVerdictSignals(input)))
  })
})
