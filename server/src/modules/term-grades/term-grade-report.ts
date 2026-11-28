import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { GRADE_THRESHOLDS } from '../ministry/ministry.service'
import { calculateTermGrade, resolveTermGrade, type TermGradeSource } from './term-grade-calc'

/** Максимальная оценка по шкале школы (5 или 10). Школа не найдена — пятибалльная. */
export async function scaleMaxOf(prisma: PrismaService, kindergartenId: string | null | undefined): Promise<number> {
  const school = kindergartenId
    ? await prisma.kindergarten.findUnique({ where: { id: kindergartenId }, select: { gradeScale: true } })
    : null
  return GRADE_THRESHOLDS[school?.gradeScale ?? 'FIVE'].max
}

export interface StudentTermSubject {
  subject: { id: string; name: string; color: string }
  value: number
  source: TermGradeSource
  /** TEACHER — когда поставил учитель (ISO); SYSTEM — по какую дату есть оценки (YYYY-MM-DD). */
  date: string
  /** Средний балл по оценкам периода (null — оценок нет или они вне шкалы). */
  average: number | null
  count: number
}

export interface StudentTermReport {
  scaleMax: number
  terms: Array<{
    id: string
    name: string
    type: string
    startDate: string
    endDate: string
    /** Период уже закончился: расчётные итоги больше не «предварительные». */
    finished: boolean
    subjects: StudentTermSubject[]
  }>
}

/** Календарная дата «сегодня» как UTC-полночь (так хранятся @db.Date). */
function today(): Date {
  const n = new Date()
  const pad = (x: number) => String(x).padStart(2, '0')
  return new Date(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`)
}

const day = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Итоги четвертей одного ученика — для родителя и самого ученика. По каждому периоду школы
 * перечислены предметы, где есть действующий итог: оценка учителя или расчёт по оценкам периода.
 * Периоды без итогов (в том числе будущие) не возвращаются. Доступ к ученику проверяет вызывающий.
 */
export async function buildStudentTermReport(
  prisma: PrismaService,
  student: { id: string; kindergartenId: string | null },
): Promise<StudentTermReport> {
  const scaleMax = await scaleMaxOf(prisma, student.kindergartenId)
  // Ученик без школы (старые данные): чужие периоды не берём.
  if (!student.kindergartenId) return { scaleMax, terms: [] }

  const terms = await prisma.term.findMany({
    where: { kindergartenId: student.kindergartenId },
    orderBy: { startDate: 'asc' },
  })
  if (terms.length === 0) return { scaleMax, terms: [] }

  const from = terms.reduce((min, t) => (t.startDate < min ? t.startDate : min), terms[0].startDate)
  const to = terms.reduce((max, t) => (t.endDate > max ? t.endDate : max), terms[0].endDate)
  const subjectSelect = { select: { id: true, name: true, color: true } }
  const [grades, manual] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId: student.id, date: { gte: from, lte: to } },
      select: { subjectId: true, value: true, date: true, subject: subjectSelect },
    }),
    prisma.termGrade.findMany({
      where: { studentId: student.id, termId: { in: terms.map((t) => t.id) } },
      select: { termId: true, subjectId: true, value: true, setAt: true, subject: subjectSelect },
    }),
  ])

  const now = today()
  const result: StudentTermReport['terms'] = []
  for (const term of terms) {
    const bySubject = new Map<string, { subject: StudentTermSubject['subject']; grades: typeof grades }>()
    for (const g of grades) {
      if (g.date < term.startDate || g.date > term.endDate) continue
      const cur = bySubject.get(g.subjectId) ?? { subject: g.subject, grades: [] }
      cur.grades.push(g)
      bySubject.set(g.subjectId, cur)
    }
    const set = new Map(manual.filter((m) => m.termId === term.id).map((m) => [m.subjectId, m]))
    for (const m of set.values()) {
      if (!bySubject.has(m.subjectId)) bySubject.set(m.subjectId, { subject: m.subject, grades: [] })
    }

    const subjects: StudentTermSubject[] = []
    for (const [subjectId, item] of bySubject) {
      const own = set.get(subjectId)
      const view = resolveTermGrade(
        own ? { value: own.value, setAt: own.setAt, setBy: null } : null,
        calculateTermGrade(item.grades, scaleMax),
      )
      if (view.value === null || view.source === null || view.date === null) continue
      subjects.push({
        subject: item.subject,
        value: view.value,
        source: view.source,
        date: view.date,
        average: view.calculated.average,
        count: view.calculated.count,
      })
    }
    if (subjects.length === 0) continue
    subjects.sort((a, b) => a.subject.name.localeCompare(b.subject.name, 'ru'))
    result.push({
      id: term.id,
      name: term.name,
      type: term.type,
      startDate: day(term.startDate),
      endDate: day(term.endDate),
      finished: term.endDate < now,
      subjects,
    })
  }
  return { scaleMax, terms: result }
}
