/** Отчёт директору: сводка по школе и по каждому классу. */

export interface ReportStudent {
  id: string
  name: string
}

export interface ReportGroupInput {
  id: string
  name: string
  students: ReportStudent[]
}

export interface ReportSubject {
  id: string
  name: string
}

export interface ReportGrade {
  value: number
  /** День оценки, YYYY-MM-DD */
  date: string
  studentId: string
  studentName: string
  groupId: string
  subjectId: string
  subjectName: string
}

export interface DirectorReport {
  /** five — все оценки до 5, ten — в периоде есть оценка выше 5. */
  scale: 'five' | 'ten'
  summary: {
    /** Среднее по всем оценкам периода. */
    average: number | null
    gradesCount: number
    excellent: number
    good: number
    satisfactory: number
    poor: number
    /**
     * Доля пар «ученик × предмет», по которым есть хотя бы одна оценка.
     * Предметы класса — из расписания; если расписания нет, берутся все предметы школы.
     */
    completeness: number | null
  }
  bestStudents: {
    studentId: string
    name: string
    groupName: string
    average: number
    count: number
  }[]
  worstGrades: {
    studentId: string
    name: string
    groupName: string
    subjectName: string
    value: number
    date: string
  }[]
  groups: {
    groupId: string
    name: string
    students: number
    average: number | null
    gradesCount: number
    excellent: number
    poor: number
    completeness: number | null
    subjects: number
    lowest: { name: string; subjectName: string; value: number } | null
  }[]
}

type Band = 'excellent' | 'good' | 'satisfactory' | 'poor'

/** 5 — отлично на пятибалльной; 9–10 — на десятибалльной. Оценка до 5 читается как пятибалльная. */
export function gradeBand(value: number): Band {
  if (value <= 5) {
    if (value >= 5) return 'excellent'
    if (value >= 4) return 'good'
    if (value >= 3) return 'satisfactory'
    return 'poor'
  }
  if (value >= 9) return 'excellent'
  if (value >= 7) return 'good'
  if (value >= 5) return 'satisfactory'
  return 'poor'
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Number((sum / values.length).toFixed(2))
}

function subjectsOf(
  groupId: string,
  subjectsByGroup: Map<string, ReportSubject[]>,
  schoolSubjects: ReportSubject[],
): ReportSubject[] {
  const scheduled = subjectsByGroup.get(groupId) ?? []
  const source = scheduled.length > 0 ? scheduled : schoolSubjects
  const seen = new Set<string>()
  const out: ReportSubject[] = []
  for (const s of source) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    out.push(s)
  }
  return out
}

/** Сколько пар «ученик × предмет» закрыто хотя бы одной оценкой. */
function filledCells(studentIds: string[], subjectIds: string[], grades: ReportGrade[]): number {
  if (studentIds.length === 0 || subjectIds.length === 0) return 0
  const students = new Set(studentIds)
  const subjects = new Set(subjectIds)
  const filled = new Set<string>()
  for (const g of grades) {
    if (!students.has(g.studentId) || !subjects.has(g.subjectId)) continue
    filled.add(`${g.studentId}|${g.subjectId}`)
  }
  return filled.size
}

export function buildDirectorReport(input: {
  groups: ReportGroupInput[]
  subjectsByGroup: Map<string, ReportSubject[]>
  schoolSubjects: ReportSubject[]
  grades: ReportGrade[]
}): DirectorReport {
  const groupName = new Map(input.groups.map((g) => [g.id, g.name]))
  const scale: 'five' | 'ten' = input.grades.some((g) => g.value > 5) ? 'ten' : 'five'

  const bands = { excellent: 0, good: 0, satisfactory: 0, poor: 0 }
  for (const g of input.grades) bands[gradeBand(g.value)]++

  const byStudent = new Map<string, { name: string; groupId: string; values: number[] }>()
  for (const g of input.grades) {
    const row = byStudent.get(g.studentId) ?? {
      name: g.studentName,
      groupId: g.groupId,
      values: [],
    }
    row.values.push(g.value)
    byStudent.set(g.studentId, row)
  }

  const bestStudents = [...byStudent.entries()]
    .map(([studentId, row]) => ({
      studentId,
      name: row.name,
      groupName: groupName.get(row.groupId) ?? '',
      average: average(row.values) ?? 0,
      count: row.values.length,
    }))
    .sort((a, b) => b.average - a.average || b.count - a.count || a.name.localeCompare(b.name, 'ru'))
    .slice(0, 5)

  const worstGrades = [...input.grades]
    .sort((a, b) => a.value - b.value || b.date.localeCompare(a.date))
    .slice(0, 8)
    .map((g) => ({
      studentId: g.studentId,
      name: g.studentName,
      groupName: groupName.get(g.groupId) ?? '',
      subjectName: g.subjectName,
      value: g.value,
      date: g.date,
    }))

  let filledTotal = 0
  let expectedTotal = 0

  const groups = input.groups.map((group) => {
    const grades = input.grades.filter((g) => g.groupId === group.id)
    const subjects = subjectsOf(group.id, input.subjectsByGroup, input.schoolSubjects)
    const expected = group.students.length * subjects.length
    const filled = filledCells(
      group.students.map((s) => s.id),
      subjects.map((s) => s.id),
      grades,
    )
    filledTotal += filled
    expectedTotal += expected

    const values = grades.map((g) => g.value)
    const lowestGrade = [...grades].sort((a, b) => a.value - b.value || b.date.localeCompare(a.date))[0]
    let excellent = 0
    let poor = 0
    for (const v of values) {
      const band = gradeBand(v)
      if (band === 'excellent') excellent++
      if (band === 'poor') poor++
    }

    return {
      groupId: group.id,
      name: group.name,
      students: group.students.length,
      average: average(values),
      gradesCount: values.length,
      excellent,
      poor,
      completeness: expected > 0 ? Math.round((filled / expected) * 100) : null,
      subjects: subjects.length,
      lowest: lowestGrade
        ? { name: lowestGrade.studentName, subjectName: lowestGrade.subjectName, value: lowestGrade.value }
        : null,
    }
  })

  return {
    scale,
    summary: {
      average: average(input.grades.map((g) => g.value)),
      gradesCount: input.grades.length,
      ...bands,
      completeness: expectedTotal > 0 ? Math.round((filledTotal / expectedTotal) * 100) : null,
    },
    bestStudents,
    worstGrades,
    groups,
  }
}
