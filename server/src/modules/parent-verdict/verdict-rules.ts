/**
 * Правила сигналов «Ежемесячного вердикта родителю». ЧИСТЫЕ функции: ни базы, ни времени, ни
 * случайности — одни и те же входные данные всегда дают тот же результат (его можно показать
 * учителю и доказать родителю, откуда взялся вывод).
 *
 * Принципы (см. план `parent-monthly-verdict-plan.md`):
 *  - мало данных — молчим: у каждого правила есть минимум оценок/заданий/уроков;
 *  - ребёнок сравнивается только с самим собой в прошлом месяце. В результате НЕТ места в классе,
 *    среднего по классу и любых чисел одноклассников. Данные класса используются лишь как «ведётся ли
 *    журнал» (каникулы, не ведут журнал по предмету) и «проверил ли учитель задание»;
 *  - оценка вне шкалы школы блокирует вердикт этого ученика (его не считаем вовсе, а не «как получится»);
 *  - здесь только сигналы и цифры. Слова для родителя — на следующих этапах.
 */

import { addDays, eachDay, monthEnd, monthStart, previousMonth, weekdayOf } from './verdict-dates'
import type { VerdictScale, VerdictThresholds } from './verdict-scale'

export type AttendanceStatusValue = 'PRESENT' | 'ABSENT' | 'SICK' | 'VACATION'

export interface RulesInput {
  /** Месяц вердикта, YYYY-MM. */
  month: string
  /** Последний учтённый день: конец месяца, а для текущего месяца — сегодня. YYYY-MM-DD. */
  asOf: string
  scale: VerdictScale
  thresholds: VerdictThresholds
  subjects: { id: string; name: string }[]
  /** Активные ученики одного класса. */
  students: { id: string }[]
  /** Оценки класса за прошлый месяц и месяц вердикта до asOf. createdAt — для порядка в один день. */
  grades: { studentId: string; subjectId: string; value: number; date: string; createdAt?: string }[]
  attendance: { studentId: string; date: string; status: AttendanceStatusValue }[]
  /** Недельное расписание класса. subjectId = null — урок без привязки к предмету. */
  schedule: { subjectId: string | null; dayOfWeek: number }[]
  /** Учебные периоды школы. Пусто — каникулы определяем только по журналу. */
  terms: { startDate: string; endDate: string }[]
  /** Домашние задания класса со сроком в месяце вердикта и отметками учеников. */
  homework: { id: string; subjectId: string; dueDate: string; submissions: { studentId: string; status: string }[] }[]
  /** Выключенный раздел школы → сигналы, которым нужны его данные, не считаются. */
  sections: { attendance: boolean; schedule: boolean; homework: boolean }
}

export type Signal =
  /** По предмету нет оценок. scope «class» — по предмету не ставили оценки НИКОМУ в классе. */
  | { code: 'NO_GRADES'; subjectId: string; scope: 'student' | 'class'; lessons: number; days: number }
  | { code: 'WEAK'; subjectId: string; average: number; gradesCount: number; reasons: ('AVERAGE' | 'BAD_MARKS_IN_ROW')[] }
  | { code: 'DROP'; subjectId: string; from: number; to: number }
  | { code: 'HOMEWORK'; subjectId: string; notDone: number; assessed: number }
  | { code: 'ABSENCES'; subjectId: string; lessons: number; days: number }
  | { code: 'STRONG'; subjectId: string; average: number; previousAverage: number }

export type SignalCode = Signal['code']

/**
 * Приоритет сигналов при равенстве числа сигналов у предметов: чем раньше, тем важнее.
 * «Похвала» (STRONG) в акцент не входит.
 */
export const PROBLEM_PRIORITY: SignalCode[] = ['WEAK', 'DROP', 'HOMEWORK', 'ABSENCES', 'NO_GRADES']

export interface SubjectResult {
  subjectId: string
  subjectName: string
  /** Средний за месяц вердикта (1 знак), null — оценок нет. Только этот ученик. */
  average: number | null
  gradesCount: number
  /** Средний за прошлый месяц (1 знак), null — оценок нет. Только этот же ученик. */
  previousAverage: number | null
  previousGradesCount: number
  signals: Signal[]
}

export interface StudentResult {
  studentId: string
  /** Если не null — вердикт по ученику не строим, пока не исправят данные. */
  blocked: { reason: 'GRADE_OUT_OF_SCALE'; count: number } | null
  subjects: SubjectResult[]
  /** Акцент месяца: один предмет с наибольшим числом проблемных сигналов; null — проблем нет. */
  focus: { subjectId: string; subjectName: string; signals: Signal[] } | null
}

export interface RulesResult {
  month: string
  asOf: string
  /** Окно правила «нет оценок». */
  window: { from: string; to: string }
  /** Ни у кого в классе за окно нет ни одной оценки: каникулы или журнал не ведут — «нет оценок» не выдаём. */
  journalSilent: boolean
  /** Сколько учеников заблокировано оценками вне шкалы. */
  blockedStudents: number
  students: StudentResult[]
}

/** Десятые доли: целое число, чтобы сравнивать пороги без ошибок плавающей точки (3,5 → 35). */
const tenthsOf = (value: number) => Math.round(value * 10)

/** Средний балл в десятых долях, округление «от половины вверх» (3,45 → 3,5), null — оценок нет. */
function averageTenths(values: number[]): number | null {
  if (!values.length) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum * 10) / values.length)
}

const fromTenths = (tenths: number | null) => (tenths === null ? null : tenths / 10)

const compareGrades = (
  a: { date: string; createdAt?: string },
  b: { date: string; createdAt?: string },
) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : (a.createdAt ?? '') > (b.createdAt ?? '') ? 1 : 0)

function hasBadRun(values: number[], badMark: number, run: number): boolean {
  let streak = 0
  for (const value of values) {
    streak = value <= badMark ? streak + 1 : 0
    if (streak >= run) return true
  }
  return false
}

export function computeVerdictSignals(input: RulesInput): RulesResult {
  const { month, asOf, thresholds: t, sections } = input
  const prev = previousMonth(month)
  const monthFrom = monthStart(month)
  const prevFrom = monthStart(prev)
  const prevTo = monthEnd(prev)
  const windowFrom = addDays(asOf, -(t.noGradesDays - 1))

  const subjectName = new Map(input.subjects.map((s) => [s.id, s.name]))
  const studentIds = new Set(input.students.map((s) => s.id))

  const inTerm = (day: string) =>
    input.terms.length === 0 || input.terms.some((term) => day >= term.startDate && day <= term.endDate)

  // ── расписание: уроков предмета по дням недели и дни недели, когда в классе есть уроки ──
  const lessonsPerWeekday = new Map<string, number[]>()
  const schoolWeekdays = new Set<number>()
  for (const item of input.schedule) {
    if (item.dayOfWeek < 1 || item.dayOfWeek > 7) continue
    schoolWeekdays.add(item.dayOfWeek)
    if (!item.subjectId) continue
    const counts = lessonsPerWeekday.get(item.subjectId) ?? new Array<number>(8).fill(0)
    counts[item.dayOfWeek]++
    lessonsPerWeekday.set(item.subjectId, counts)
  }
  const lessonsOn = (subjectId: string, day: string) => lessonsPerWeekday.get(subjectId)?.[weekdayOf(day)] ?? 0

  const windowSchoolDays = eachDay(windowFrom, asOf).filter((day) => inTerm(day) && schoolWeekdays.has(weekdayOf(day)))

  // ── оценки: по ученику и предмету ──
  type GradeRow = RulesInput['grades'][number]
  const byStudentSubject = new Map<string, GradeRow[]>()
  const outOfScale = new Map<string, number>()
  const gradedInWindowBySubject = new Set<string>()
  let classHasGradesInWindow = false
  for (const grade of [...input.grades].sort(compareGrades)) {
    if (!studentIds.has(grade.studentId)) continue
    if (grade.date > asOf || grade.date < prevFrom) continue
    const key = `${grade.studentId}|${grade.subjectId}`
    const list = byStudentSubject.get(key)
    if (list) list.push(grade)
    else byStudentSubject.set(key, [grade])
    if (!Number.isInteger(grade.value) || grade.value < 1 || grade.value > t.scaleMax) {
      outOfScale.set(grade.studentId, (outOfScale.get(grade.studentId) ?? 0) + 1)
    }
    if (grade.date >= windowFrom) {
      classHasGradesInWindow = true
      gradedInWindowBySubject.add(grade.subjectId)
    }
  }
  const validIn = (rows: GradeRow[] | undefined, from: string, to: string) =>
    (rows ?? []).filter((g) => g.date >= from && g.date <= to && Number.isInteger(g.value) && g.value >= 1 && g.value <= t.scaleMax)
  const anyIn = (rows: GradeRow[] | undefined, from: string, to: string) =>
    (rows ?? []).some((g) => g.date >= from && g.date <= to)

  // ── посещаемость ──
  const statusOf = new Map<string, Map<string, AttendanceStatusValue>>()
  for (const row of input.attendance) {
    if (!studentIds.has(row.studentId)) continue
    const days = statusOf.get(row.studentId) ?? new Map<string, AttendanceStatusValue>()
    days.set(row.date, row.status)
    statusOf.set(row.studentId, days)
  }

  // ── домашние задания: «проверено» = учитель отметил не меньше доли класса ──
  const assessedHomework = input.homework
    .filter((hw) => hw.dueDate >= monthFrom && hw.dueDate <= asOf)
    .map((hw) => {
      const marks = new Map<string, string>()
      for (const sub of hw.submissions) if (studentIds.has(sub.studentId)) marks.set(sub.studentId, sub.status)
      const share = studentIds.size ? marks.size / studentIds.size : 0
      return { subjectId: hw.subjectId, marks, assessed: share >= t.homeworkMinMarkedShare }
    })
    .filter((hw) => hw.assessed)

  // ── какие предметы рассматриваем ──
  const subjectIds = new Set<string>()
  for (const id of lessonsPerWeekday.keys()) subjectIds.add(id)
  for (const key of byStudentSubject.keys()) subjectIds.add(key.slice(key.indexOf('|') + 1))
  for (const hw of assessedHomework) subjectIds.add(hw.subjectId)
  const orderedSubjects = [...subjectIds]
    .filter((id) => subjectName.has(id))
    .sort((a, b) => subjectName.get(a)!.localeCompare(subjectName.get(b)!, 'ru') || a.localeCompare(b))

  const weakT = tenthsOf(t.weakAverage)
  const dropT = tenthsOf(t.dropBy)
  const strongT = tenthsOf(t.strongAverage)
  const notDonePercent = Math.round(t.homeworkNotDoneShare * 100)

  const students: StudentResult[] = input.students.map((student) => {
    const bad = outOfScale.get(student.id)
    if (bad) {
      return { studentId: student.id, blocked: { reason: 'GRADE_OUT_OF_SCALE', count: bad }, subjects: [], focus: null }
    }

    const attendanceByDay = statusOf.get(student.id)
    const subjects: SubjectResult[] = []

    for (const subjectId of orderedSubjects) {
      const rows = byStudentSubject.get(`${student.id}|${subjectId}`)
      const monthGrades = validIn(rows, monthFrom, asOf).map((g) => g.value)
      const prevGrades = validIn(rows, prevFrom, prevTo).map((g) => g.value)
      const avg = averageTenths(monthGrades)
      const prevAvg = averageTenths(prevGrades)
      const signals: Signal[] = []

      // Слабый предмет: средний ниже порога или «плохие» оценки подряд.
      if (monthGrades.length >= t.weakMinGrades) {
        const reasons: ('AVERAGE' | 'BAD_MARKS_IN_ROW')[] = []
        if (avg !== null && avg < weakT) reasons.push('AVERAGE')
        if (hasBadRun(monthGrades, t.badMark, t.badMarksInRow)) reasons.push('BAD_MARKS_IN_ROW')
        if (reasons.length) signals.push({ code: 'WEAK', subjectId, average: avg! / 10, gradesCount: monthGrades.length, reasons })
      }

      // Падение: средний за месяц ниже прошлого месяца на порог и больше.
      if (
        avg !== null && prevAvg !== null &&
        monthGrades.length >= t.dropMinGrades && prevGrades.length >= t.dropMinGrades &&
        prevAvg - avg >= dropT
      ) {
        signals.push({ code: 'DROP', subjectId, from: prevAvg / 10, to: avg / 10 })
      }

      // Домашние задания: не сдано от порога доли проверенных заданий.
      if (sections.homework) {
        let assessed = 0
        let notDone = 0
        for (const hw of assessedHomework) {
          if (hw.subjectId !== subjectId) continue
          const status = hw.marks.get(student.id)
          if (!status) continue // не отмечено — не считаем ни сданным, ни не сданным
          assessed++
          if (status === 'NOT_DONE') notDone++
        }
        if (assessed >= t.homeworkMinAssessed && notDone * 100 >= assessed * notDonePercent) {
          signals.push({ code: 'HOMEWORK', subjectId, notDone, assessed })
        }
      }

      // Пропуски: по расписанию, только отметки «не был» (болезнь и отпуск не считаем).
      if (sections.attendance && sections.schedule && attendanceByDay) {
        let lessons = 0
        let days = 0
        for (const [day, status] of attendanceByDay) {
          if (status !== 'ABSENT' || day < monthFrom || day > asOf || !inTerm(day)) continue
          const count = lessonsOn(subjectId, day)
          if (count > 0) {
            lessons += count
            days++
          }
        }
        if (lessons >= t.absenceMinLessons) signals.push({ code: 'ABSENCES', subjectId, lessons, days })
      }

      // Нет оценок за окно, хотя уроки были, а ученик мог быть на них.
      if (sections.schedule && classHasGradesInWindow && windowSchoolDays.length > 0 && !anyIn(rows, windowFrom, asOf)) {
        const missing = (day: string) => {
          const status = sections.attendance ? attendanceByDay?.get(day) : undefined
          return status === 'ABSENT' || status === 'SICK' || status === 'VACATION'
        }
        const absentDays = windowSchoolDays.filter(missing).length
        if (absentDays / windowSchoolDays.length <= t.noGradesMaxAbsentShare) {
          const lessons = windowSchoolDays.filter((day) => !missing(day)).reduce((sum, day) => sum + lessonsOn(subjectId, day), 0)
          if (lessons >= t.noGradesMinLessons) {
            signals.push({
              code: 'NO_GRADES',
              subjectId,
              scope: gradedInWindowBySubject.has(subjectId) ? 'student' : 'class',
              lessons,
              days: t.noGradesDays,
            })
          }
        }
      }

      // Сильный предмет: средний высокий два месяца подряд.
      if (
        avg !== null && prevAvg !== null &&
        monthGrades.length >= t.strongMinGrades && prevGrades.length >= t.strongMinGrades &&
        avg >= strongT && prevAvg >= strongT
      ) {
        signals.push({ code: 'STRONG', subjectId, average: avg / 10, previousAverage: prevAvg / 10 })
      }

      if (signals.length || monthGrades.length || prevGrades.length) {
        subjects.push({
          subjectId,
          subjectName: subjectName.get(subjectId)!,
          average: fromTenths(avg),
          gradesCount: monthGrades.length,
          previousAverage: fromTenths(prevAvg),
          previousGradesCount: prevGrades.length,
          signals,
        })
      }
    }

    return { studentId: student.id, blocked: null, subjects, focus: pickFocus(subjects) }
  })

  return {
    month,
    asOf,
    window: { from: windowFrom, to: asOf },
    journalSilent: !classHasGradesInWindow,
    blockedStudents: students.filter((s) => s.blocked).length,
    students,
  }
}

/** Проблемные сигналы, из которых складывается акцент. «Нет оценок у всего класса» — не вина ребёнка, не считаем. */
const isFocusSignal = (signal: Signal) =>
  signal.code !== 'STRONG' && !(signal.code === 'NO_GRADES' && signal.scope === 'class')

/**
 * Акцент месяца: предмет с наибольшим числом проблемных сигналов. При равенстве — по приоритету
 * сигналов (слабый > падение > ДЗ > пропуски > нет оценок), затем ниже средний балл, затем по названию:
 * результат не зависит от порядка данных. Проблем нет — акцента нет (не выдумываем).
 */
export function pickFocus(subjects: SubjectResult[]): StudentResult['focus'] {
  const candidates = subjects
    .map((subject) => ({ subject, signals: subject.signals.filter(isFocusSignal) }))
    .filter((c) => c.signals.length > 0)
  if (!candidates.length) return null

  const bestPriority = (signals: Signal[]) => Math.min(...signals.map((s) => PROBLEM_PRIORITY.indexOf(s.code)))
  candidates.sort(
    (a, b) =>
      b.signals.length - a.signals.length ||
      bestPriority(a.signals) - bestPriority(b.signals) ||
      (a.subject.average ?? Infinity) - (b.subject.average ?? Infinity) ||
      a.subject.subjectName.localeCompare(b.subject.subjectName, 'ru') ||
      a.subject.subjectId.localeCompare(b.subject.subjectId),
  )
  const top = candidates[0]
  return { subjectId: top.subject.subjectId, subjectName: top.subject.subjectName, signals: top.signals }
}
