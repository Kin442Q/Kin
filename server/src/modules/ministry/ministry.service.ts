import { BadRequestException, Injectable } from '@nestjs/common'
import type { GradeScale, Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { MinistryScopeService, type ViewerAccess } from './ministry-scope.service'

/**
 * Пороги оценок по шкале школы. «Качество знаний» — доля оценок «хорошо» и «отлично», «успеваемость» —
 * доля оценок не ниже удовлетворительной. Для десятибалльной шкалы взяты 7 и 4 (соответствуют 4 и 3
 * по пятибалльной); при смене методики правится только эта таблица и SQL ниже.
 */
export const GRADE_THRESHOLDS: Record<GradeScale, { max: number; good: number; pass: number }> = {
  FIVE: { max: 5, good: 4, pass: 3 },
  TEN: { max: 10, good: 7, pass: 4 },
}

/** Самый длинный период, за который строится сводка. */
const MAX_PERIOD_DAYS = 366
const DEFAULT_PERIOD_DAYS = 30
/** Сколько школ с самыми низкими показателями вынести на главный экран. */
const ATTENTION_LIMIT = 5

export interface MinistryQuery {
  regionId?: string
  districtId?: string
  /** Начало периода, YYYY-MM-DD (по умолчанию 30 дней назад). */
  from?: string
  /** Конец периода включительно, YYYY-MM-DD (по умолчанию сегодня). */
  to?: string
  q?: string
}

export interface GeoName {
  id: string
  nameRu: string
  nameTg: string
  nameEn: string
}

/** Суммы, из которых складываются показатели; суммируются по школам, районам и области без потерь. */
interface Acc {
  grades: number
  /** Сумма оценок, переведённых в долю от максимума шкалы (5 из 5 = 1, 7 из 10 = 0,7). */
  gradeShare: number
  good: number
  passed: number
  present: number
  absent: number
  sick: number
  vacation: number
}

const emptyAcc = (): Acc => ({ grades: 0, gradeShare: 0, good: 0, passed: 0, present: 0, absent: 0, sick: 0, vacation: 0 })

function addAcc(target: Acc, source: Acc): Acc {
  for (const key of Object.keys(target) as Array<keyof Acc>) target[key] += source[key]
  return target
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Показатели по сумме; null — данных нет, а не ноль (школа без оценок не «плохая», она не заполнила журнал). */
export interface Metrics {
  gradesCount: number
  /** Средняя оценка в процентах от максимума шкалы: 100 — все оценки наивысшие. Сравнима между шкалами 5 и 10. */
  avgPercent: number | null
  /** Доля оценок «хорошо» и «отлично», %. */
  quality: number | null
  /** Доля оценок не ниже удовлетворительной, %. */
  success: number | null
  attendanceMarks: number
  /** Доля присутствовавших от учётных дней (без каникул и отпусков), %. */
  attendanceRate: number | null
  /** Доля дней по болезни от учётных дней, %. */
  illnessRate: number | null
}

export function metricsOf(a: Acc): Metrics {
  const marks = a.present + a.absent + a.sick
  return {
    gradesCount: a.grades,
    avgPercent: a.grades ? round1((a.gradeShare / a.grades) * 100) : null,
    quality: a.grades ? round1((a.good / a.grades) * 100) : null,
    success: a.grades ? round1((a.passed / a.grades) * 100) : null,
    attendanceMarks: marks,
    attendanceRate: marks ? round1((a.present / marks) * 100) : null,
    illnessRate: marks ? round1((a.sick / marks) * 100) : null,
  }
}

export interface SchoolRow extends Metrics {
  id: string
  name: string
  gradeScale: GradeScale
  region: GeoName | null
  district: GeoName | null
  latitude: number | null
  longitude: number | null
  students: number
  teachers: number
  classes: number
  studentsPerTeacher: number | null
  /** Место в рейтинге по средней оценке среди школ выборки; null — оценок за период нет. */
  rank: number | null
  /** Чего не хватает в данных школы за период — чтобы пустое не читалось как плохое. */
  flags: { noGrades: boolean; noAttendance: boolean; noTeachers: boolean; noLocation: boolean }
}

export interface Rollup extends Metrics {
  schools: number
  students: number
  teachers: number
  classes: number
  studentsPerTeacher: number | null
  schoolsWithGrades: number
  schoolsWithAttendance: number
}

interface Collected {
  period: { from: string; to: string }
  access: ViewerAccess
  rows: SchoolRow[]
  accs: Map<string, Acc>
}

type KindergartenWithGeo = Prisma.KindergartenGetPayload<{
  select: {
    id: true
    name: true
    gradeScale: true
    latitude: true
    longitude: true
    district: {
      select: {
        id: true
        nameRu: true
        nameTg: true
        nameEn: true
        sortOrder: true
        region: { select: { id: true; nameRu: true; nameTg: true; nameEn: true; sortOrder: true } }
      }
    }
  }
}>

interface GradeRow { schoolId: string; grades: number; gradeShare: number; good: number; passed: number }
interface AttendanceRow { schoolId: string; present: number; absent: number; sick: number; vacation: number }

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** YYYY-MM-DD → дата в UTC; всё остальное — 400 (а не молчаливый «Invalid Date» в запросе). */
function parseDay(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${label}: ожидается дата в формате ГГГГ-ММ-ДД`)
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime()) || isoDay(d) !== value) throw new BadRequestException(`${label}: такой даты нет`)
  return d
}

export function resolvePeriod(from?: string, to?: string, now: Date = new Date()): { from: Date; to: Date } {
  const end = to ? parseDay(to, 'Конец периода') : parseDay(isoDay(now), 'Сегодня')
  const start = from ? parseDay(from, 'Начало периода') : new Date(end.getTime() - (DEFAULT_PERIOD_DAYS - 1) * 86_400_000)
  if (start > end) throw new BadRequestException('Начало периода позже его конца')
  if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_PERIOD_DAYS) {
    throw new BadRequestException(`Период не длиннее ${MAX_PERIOD_DAYS} дней`)
  }
  return { from: start, to: end }
}

const geo = (g: GeoName & { sortOrder?: number }): GeoName => ({ id: g.id, nameRu: g.nameRu, nameTg: g.nameTg, nameEn: g.nameEn })

@Injectable()
export class MinistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: MinistryScopeService,
  ) {}

  /** Кто я и что вижу: для шапки кабинета и фильтров «область → район» (только в пределах охвата). */
  async filters(user: AuthUser) {
    const access = await this.scope.resolve(user)
    const regions = await this.prisma.region.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { districts: { orderBy: { sortOrder: 'asc' } } },
    })
    const allowedRegions = new Set(access.regionIds)
    const allowedDistricts = new Set(access.districtIds)

    const tree = regions
      .map((r) => ({
        ...geo(r),
        code: r.code,
        districts: r.districts
          .filter((d) => access.allSchools || allowedRegions.has(r.id) || allowedDistricts.has(d.id))
          .map((d) => ({ ...geo(d), code: d.code, kind: d.kind })),
      }))
      .filter((r) => r.districts.length > 0)

    return { organization: access.organization, allSchools: access.allSchools, regions: tree }
  }

  /** Главный экран: итоги по выборке, срез по областям и школы, которым нужно внимание. */
  async overview(user: AuthUser, query: MinistryQuery) {
    const { period, rows, accs } = await this.collect(user, query)
    const total = this.rollup(rows, [...accs.values()])

    const byRegion = new Map<string, { region: GeoName | null; rows: SchoolRow[] }>()
    for (const row of rows) {
      const key = row.region?.id ?? ''
      const bucket = byRegion.get(key) ?? { region: row.region, rows: [] }
      bucket.rows.push(row)
      byRegion.set(key, bucket)
    }
    const regions = [...byRegion.values()].map((b) => ({
      region: b.region,
      ...this.rollup(b.rows, b.rows.map((r) => accs.get(r.id)!)),
    }))

    // Школы с самой низкой средней оценкой — только те, у кого она есть: «нет данных» — отдельная строка.
    const attention = rows
      .filter((r) => r.avgPercent !== null)
      .sort((a, b) => a.avgPercent! - b.avgPercent!)
      .slice(0, ATTENTION_LIMIT)
      .map((r) => ({ id: r.id, name: r.name, district: r.district, region: r.region, avgPercent: r.avgPercent, quality: r.quality }))

    return {
      period,
      total,
      regions,
      attention,
      noData: {
        grades: rows.filter((r) => r.flags.noGrades).length,
        attendance: rows.filter((r) => r.flags.noAttendance).length,
        teachers: rows.filter((r) => r.flags.noTeachers).length,
      },
    }
  }

  /** Школы выборки: рейтинг, нагрузка, посещаемость, координаты для карты. */
  async schools(user: AuthUser, query: MinistryQuery) {
    const { period, rows } = await this.collect(user, query)
    const q = query.q?.trim().toLowerCase()
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows
    return { period, schools: list }
  }

  /** Сравнение районов: одна строка на район или город, с областью. */
  async districts(user: AuthUser, query: MinistryQuery) {
    const { period, rows, accs } = await this.collect(user, query)

    const byDistrict = new Map<string, { district: GeoName | null; region: GeoName | null; rows: SchoolRow[] }>()
    for (const row of rows) {
      const key = row.district?.id ?? ''
      const bucket = byDistrict.get(key) ?? { district: row.district, region: row.region, rows: [] }
      bucket.rows.push(row)
      byDistrict.set(key, bucket)
    }
    const districts = [...byDistrict.values()].map((b) => ({
      district: b.district,
      region: b.region,
      ...this.rollup(b.rows, b.rows.map((r) => accs.get(r.id)!)),
    }))
    // Лучший район — первым; районы без оценок уходят в конец.
    districts.sort((a, b) => (b.avgPercent ?? -1) - (a.avgPercent ?? -1))
    return { period, districts }
  }

  // ---------------------------------------------------------------------------------------------

  private rollup(rows: SchoolRow[], accs: Acc[]): Rollup {
    const acc = accs.reduce((sum, a) => addAcc(sum, a), emptyAcc())
    const students = rows.reduce((n, r) => n + r.students, 0)
    const teachers = rows.reduce((n, r) => n + r.teachers, 0)
    return {
      schools: rows.length,
      students,
      teachers,
      classes: rows.reduce((n, r) => n + r.classes, 0),
      studentsPerTeacher: teachers ? round1(students / teachers) : null,
      schoolsWithGrades: rows.filter((r) => !r.flags.noGrades).length,
      schoolsWithAttendance: rows.filter((r) => !r.flags.noAttendance).length,
      ...metricsOf(acc),
    }
  }

  /** Список школ охвата с фильтрами и показателями за период — общий источник для всех экранов. */
  private async collect(user: AuthUser, query: MinistryQuery): Promise<Collected> {
    const access = await this.scope.resolve(user)
    const { from, to } = resolvePeriod(query.from, query.to)
    const period = { from: isoDay(from), to: isoDay(to) }

    // Фильтр сужает охват, но не расширяет его: условия объединяются через AND.
    const filter: Prisma.KindergartenWhereInput = query.districtId
      ? { districtId: query.districtId }
      : query.regionId
        ? { district: { regionId: query.regionId } }
        : {}
    const schools: KindergartenWithGeo[] = await this.prisma.kindergarten.findMany({
      where: { AND: [access.where, filter] },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        gradeScale: true,
        latitude: true,
        longitude: true,
        district: {
          select: {
            id: true,
            nameRu: true,
            nameTg: true,
            nameEn: true,
            sortOrder: true,
            region: { select: { id: true, nameRu: true, nameTg: true, nameEn: true, sortOrder: true } },
          },
        },
      },
    })
    if (!schools.length) return { period, access, rows: [], accs: new Map() }

    const ids = schools.map((s) => s.id)
    const [students, teachers, classes, grades, attendance] = await Promise.all([
      this.prisma.student.groupBy({ by: ['kindergartenId'], where: { kindergartenId: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['kindergartenId'], where: { kindergartenId: { in: ids }, role: 'TEACHER', isActive: true }, _count: { _all: true } }),
      this.prisma.group.groupBy({ by: ['kindergartenId'], where: { kindergartenId: { in: ids }, isActive: true }, _count: { _all: true } }),
      this.gradeSums(ids, from, to),
      this.attendanceSums(ids, from, to),
    ])
    const countOf = (rows: Array<{ kindergartenId: string | null; _count: { _all: number } }>) =>
      new Map(rows.map((r) => [r.kindergartenId ?? '', r._count._all]))
    const studentsBy = countOf(students)
    const teachersBy = countOf(teachers)
    const classesBy = countOf(classes)
    const gradesBy = new Map(grades.map((g) => [g.schoolId, g]))
    const attendanceBy = new Map(attendance.map((a) => [a.schoolId, a]))

    const accs = new Map<string, Acc>()
    const rows: SchoolRow[] = schools.map((s) => {
      const g = gradesBy.get(s.id)
      const a = attendanceBy.get(s.id)
      const acc: Acc = {
        grades: g?.grades ?? 0,
        gradeShare: g?.gradeShare ?? 0,
        good: g?.good ?? 0,
        passed: g?.passed ?? 0,
        present: a?.present ?? 0,
        absent: a?.absent ?? 0,
        sick: a?.sick ?? 0,
        vacation: a?.vacation ?? 0,
      }
      accs.set(s.id, acc)
      const m = metricsOf(acc)
      const studentsN = studentsBy.get(s.id) ?? 0
      const teachersN = teachersBy.get(s.id) ?? 0
      return {
        id: s.id,
        name: s.name,
        gradeScale: s.gradeScale,
        region: s.district?.region ? geo(s.district.region) : null,
        district: s.district ? geo(s.district) : null,
        latitude: s.latitude,
        longitude: s.longitude,
        students: studentsN,
        teachers: teachersN,
        classes: classesBy.get(s.id) ?? 0,
        studentsPerTeacher: teachersN ? round1(studentsN / teachersN) : null,
        rank: null,
        flags: {
          noGrades: m.gradesCount === 0,
          noAttendance: m.attendanceMarks === 0,
          noTeachers: teachersN === 0,
          noLocation: s.latitude == null || s.longitude == null,
        },
        ...m,
      }
    })

    // Рейтинг: по средней оценке в процентах от шкалы; при равенстве — по качеству знаний.
    const ranked = rows
      .filter((r) => r.avgPercent !== null)
      .sort((a, b) => b.avgPercent! - a.avgPercent! || (b.quality ?? 0) - (a.quality ?? 0))
    ranked.forEach((r, i) => (r.rank = i + 1))

    return { period, access, rows, accs }
  }

  /**
   * Оценки за период по школам одним запросом. Показатели приводятся к шкале школы (5 или 10 баллов),
   * поэтому школы с разными системами сопоставимы. Читаются только суммы: ни имён учеников, ни
   * отдельных оценок до министерства не доходит.
   */
  private async gradeSums(ids: string[], from: Date, to: Date): Promise<GradeRow[]> {
    const five = GRADE_THRESHOLDS.FIVE
    const ten = GRADE_THRESHOLDS.TEN
    return this.prisma.$queryRaw<GradeRow[]>`
      SELECT s."kindergartenId" AS "schoolId",
             COUNT(*)::int AS "grades",
             COALESCE(SUM(g."value"::float8 / CASE WHEN k."gradeScale" = 'TEN' THEN ${ten.max}::int ELSE ${five.max}::int END), 0)::float8 AS "gradeShare",
             (COUNT(*) FILTER (WHERE g."value" >= CASE WHEN k."gradeScale" = 'TEN' THEN ${ten.good}::int ELSE ${five.good}::int END))::int AS "good",
             (COUNT(*) FILTER (WHERE g."value" >= CASE WHEN k."gradeScale" = 'TEN' THEN ${ten.pass}::int ELSE ${five.pass}::int END))::int AS "passed"
        FROM "Grade" g
        JOIN "Student" s ON s."id" = g."studentId"
        JOIN "Kindergarten" k ON k."id" = s."kindergartenId"
       WHERE s."kindergartenId" = ANY(${ids}::text[])
         AND g."date" BETWEEN ${from} AND ${to}
       GROUP BY s."kindergartenId"
    `
  }

  /** Отметки посещаемости за период по школам (через класс, в котором отмечен ученик). */
  private async attendanceSums(ids: string[], from: Date, to: Date): Promise<AttendanceRow[]> {
    return this.prisma.$queryRaw<AttendanceRow[]>`
      SELECT gr."kindergartenId" AS "schoolId",
             (COUNT(*) FILTER (WHERE a."status" = 'PRESENT'))::int AS "present",
             (COUNT(*) FILTER (WHERE a."status" = 'ABSENT'))::int AS "absent",
             (COUNT(*) FILTER (WHERE a."status" = 'SICK'))::int AS "sick",
             (COUNT(*) FILTER (WHERE a."status" = 'VACATION'))::int AS "vacation"
        FROM "Attendance" a
        JOIN "Group" gr ON gr."id" = a."groupId"
       WHERE gr."kindergartenId" = ANY(${ids}::text[])
         AND a."date" BETWEEN ${from} AND ${to}
       GROUP BY gr."kindergartenId"
    `
  }
}
