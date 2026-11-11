import { BadRequestException, ForbiddenException } from '@nestjs/common'

import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import { MinistryScopeService } from './ministry-scope.service'
import { MinistryService, metricsOf, resolvePeriod } from './ministry.service'

const viewer: AuthUser = { sub: 'v1', email: 'v@edu.tj', role: 'VIEWER', kindergartenId: null }
const owner: AuthUser = { sub: 'o1', email: 'o@x.tj', role: 'SUPER_ADMIN', kindergartenId: null }
const director: AuthUser = { sub: 'd1', email: 'd@x.tj', role: 'SUPER_ADMIN', kindergartenId: 'k1' }

const sughd = { id: 'rg_sughd', nameRu: 'Согдийская область', nameTg: 'Вилояти Суғд', nameEn: 'Sughd Region', sortOrder: 30 }
const khatlon = { id: 'rg_khatlon', nameRu: 'Хатлонская область', nameTg: 'Вилояти Хатлон', nameEn: 'Khatlon Region', sortOrder: 40 }
const asht = { id: 'ds_asht', nameRu: 'Аштский район', nameTg: 'ноҳияи Ашт', nameEn: 'Asht district', sortOrder: 1, region: sughd }
const vakhsh = { id: 'ds_vakhsh', nameRu: 'Вахшский район', nameTg: 'ноҳияи Вахш', nameEn: 'Vakhsh district', sortOrder: 1, region: khatlon }

const school = (id: string, name: string, district: typeof asht | null, gradeScale: 'FIVE' | 'TEN' = 'FIVE') => ({
  id, name, gradeScale, latitude: 40.1, longitude: 69.2, district,
})

describe('MinistryScopeService: кто какие школы видит', () => {
  let prisma: PrismaMock
  let scope: MinistryScopeService

  beforeEach(() => {
    prisma = createPrismaMock()
    scope = new MinistryScopeService(prisma as unknown as PrismaService)
  })

  it('владелец платформы видит все школы; директор школы и остальные роли — нет', async () => {
    const access = await scope.resolve(owner)
    expect(access.allSchools).toBe(true)
    expect(access.where).toEqual({ isActive: true, isDemo: false, type: 'SCHOOL' })

    await expect(scope.resolve(director)).rejects.toThrow(ForbiddenException)
    await expect(scope.resolve({ ...director, role: 'TEACHER' })).rejects.toThrow(ForbiddenException)
    await expect(scope.resolve({ ...director, role: 'ADMIN', kindergartenId: null })).rejects.toThrow(ForbiddenException)
  })

  it('министерство (allSchools) — все действующие школы, демо в статистику не попадает', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true, role: 'VIEWER', viewerScope: { organization: 'Министерство образования', allSchools: true, regions: [], districts: [] },
    })
    const access = await scope.resolve(viewer)
    expect(access).toMatchObject({ organization: 'Министерство образования', allSchools: true, where: { isActive: true, isDemo: false, type: 'SCHOOL' } })
  })

  it('районный отдел видит только школы своих областей и районов', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true, role: 'VIEWER',
      viewerScope: { organization: 'Отдел образования района Ашт', allSchools: false, regions: [{ id: 'rg_a' }], districts: [{ id: 'ds_b' }] },
    })
    const access = await scope.resolve(viewer)
    expect(access.where).toEqual({
      isActive: true, isDemo: false, type: 'SCHOOL',
      OR: [{ districtId: { in: ['ds_b'] } }, { district: { regionId: { in: ['rg_a'] } } }],
    })
    expect([access.regionIds, access.districtIds]).toEqual([['rg_a'], ['ds_b']])
  })

  it('охват пустой — условие ничего не находит, а не «все школы»', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true, role: 'VIEWER', viewerScope: { organization: 'Пустой', allSchools: false, regions: [], districts: [] },
    })
    const access = await scope.resolve(viewer)
    expect(access.where.OR).toEqual([{ districtId: { in: [] } }, { district: { regionId: { in: [] } } }])
  })

  it('отключённого наблюдателя не пускают сразу, даже если его токен ещё действует', async () => {
    prisma.user.findUnique.mockResolvedValue({ isActive: false, role: 'VIEWER', viewerScope: { organization: 'X', allSchools: true, regions: [], districts: [] } })
    await expect(scope.resolve(viewer)).rejects.toThrow('Доступ отключён')
  })

  it('без записи охвата доступа нет; пользователь, чья роль уже не VIEWER, тоже отклоняется', async () => {
    prisma.user.findUnique.mockResolvedValue({ isActive: true, role: 'VIEWER', viewerScope: null })
    await expect(scope.resolve(viewer)).rejects.toThrow('не задан охват')
    prisma.user.findUnique.mockResolvedValue({ isActive: true, role: 'TEACHER', viewerScope: null })
    await expect(scope.resolve(viewer)).rejects.toThrow(ForbiddenException)
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(scope.resolve(viewer)).rejects.toThrow(ForbiddenException)
  })
})

describe('показатели', () => {
  it('школа без данных — null, а не ноль: пустой журнал не равен плохой успеваемости', () => {
    const m = metricsOf({ grades: 0, gradeShare: 0, good: 0, passed: 0, present: 0, absent: 0, sick: 0, vacation: 0 })
    expect([m.avgPercent, m.quality, m.success, m.attendanceRate, m.illnessRate]).toEqual([null, null, null, null, null])
  })

  it('средняя в процентах от шкалы, качество и успеваемость — доли оценок; каникулы не входят в посещаемость', () => {
    // 4 оценки: 5, 4, 3, 2 по пятибалльной шкале -> доли 1, .8, .6, .4 = 2.8
    const m = metricsOf({ grades: 4, gradeShare: 2.8, good: 2, passed: 3, present: 80, absent: 10, sick: 10, vacation: 40 })
    expect(m).toMatchObject({ gradesCount: 4, avgPercent: 70, quality: 50, success: 75, attendanceMarks: 100, attendanceRate: 80, illnessRate: 10 })
  })
})

describe('период', () => {
  const now = new Date('2026-11-11T10:00:00Z')

  it('по умолчанию последние 30 дней включая сегодня', () => {
    const p = resolvePeriod(undefined, undefined, now)
    expect([p.from.toISOString().slice(0, 10), p.to.toISOString().slice(0, 10)]).toEqual(['2026-10-13', '2026-11-11'])
  })

  it('кривые даты, обратный порядок и слишком длинный период — 400', () => {
    expect(() => resolvePeriod('11.11.2026', undefined, now)).toThrow(BadRequestException)
    expect(() => resolvePeriod('2026-02-31', undefined, now)).toThrow('такой даты нет')
    expect(() => resolvePeriod('2026-11-12', '2026-11-11', now)).toThrow('позже')
    expect(() => resolvePeriod('2025-01-01', '2026-11-11', now)).toThrow('не длиннее')
  })
})

describe('MinistryService: сводки по школам охвата', () => {
  let prisma: PrismaMock
  let service: MinistryService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new MinistryService(prisma as unknown as PrismaService, new MinistryScopeService(prisma as unknown as PrismaService))
    prisma.user.findUnique.mockResolvedValue({
      isActive: true, role: 'VIEWER', viewerScope: { organization: 'Министерство образования', allSchools: true, regions: [], districts: [] },
    })
    prisma.kindergarten.findMany.mockResolvedValue([
      school('s1', 'Школа №1', asht),
      school('s2', 'Школа №2', asht, 'TEN'),
      school('s3', 'Школа №3', vakhsh),
      school('s4', 'Школа без данных', null),
    ])
    prisma.student.groupBy.mockResolvedValue([
      { kindergartenId: 's1', _count: { _all: 300 } }, { kindergartenId: 's2', _count: { _all: 100 } }, { kindergartenId: 's3', _count: { _all: 50 } },
    ])
    prisma.user.groupBy.mockResolvedValue([
      { kindergartenId: 's1', _count: { _all: 20 } }, { kindergartenId: 's2', _count: { _all: 5 } }, { kindergartenId: 's3', _count: { _all: 10 } },
    ])
    prisma.group.groupBy.mockResolvedValue([
      { kindergartenId: 's1', _count: { _all: 11 } }, { kindergartenId: 's2', _count: { _all: 4 } }, { kindergartenId: 's3', _count: { _all: 3 } },
    ])
    // порядок вызовов $queryRaw: сначала оценки, потом посещаемость
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { schoolId: 's1', grades: 100, gradeShare: 80, good: 70, passed: 95 }, // 80 %
        { schoolId: 's2', grades: 50, gradeShare: 30, good: 20, passed: 45 }, // 60 %
        { schoolId: 's3', grades: 10, gradeShare: 9, good: 9, passed: 10 }, // 90 %
      ])
      .mockResolvedValueOnce([
        { schoolId: 's1', present: 900, absent: 50, sick: 50, vacation: 0 },
        { schoolId: 's3', present: 90, absent: 5, sick: 5, vacation: 3 },
      ])
  })

  it('школы с оценками получают рейтинг по средней в процентах; без оценок — нет места и флаг «нет данных»', async () => {
    const { schools, period } = await service.schools(viewer, { from: '2026-10-01', to: '2026-10-31' })
    expect(period).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    const byId = Object.fromEntries(schools.map((s) => [s.id, s]))
    expect([byId.s3.rank, byId.s1.rank, byId.s2.rank, byId.s4.rank]).toEqual([1, 2, 3, null])
    expect(byId.s1).toMatchObject({ avgPercent: 80, quality: 70, success: 95, attendanceRate: 90, illnessRate: 5, studentsPerTeacher: 15, students: 300, teachers: 20, classes: 11 })
    expect(byId.s4.flags).toEqual({ noGrades: true, noAttendance: true, noTeachers: true, noLocation: false, scaleMismatch: false })
    expect(byId.s4.studentsPerTeacher).toBeNull()
    expect(byId.s2.flags.noAttendance).toBe(true)
  })

  it('в ответе только суммы по школам: ни имён учеников, ни отдельных оценок', async () => {
    const { schools } = await service.schools(viewer, {})
    const json = JSON.stringify(schools)
    for (const forbidden of ['firstName', 'lastName', 'motherName', 'medicalNotes', 'studentId']) expect(json).not.toContain(forbidden)
  })

  it('в запросы оценок и посещаемости уходят только школы охвата, а фильтр области сужает, но не расширяет охват', async () => {
    await service.schools(viewer, { regionId: 'rg_sughd' })
    const where = prisma.kindergarten.findMany.mock.calls[0][0].where
    expect(where).toEqual({
      AND: [{ isActive: true, isDemo: false, type: 'SCHOOL' }, { district: { regionId: 'rg_sughd' } }],
    })
    // район важнее области, если переданы оба
    prisma.$queryRaw.mockResolvedValue([])
    await service.schools(viewer, { regionId: 'rg_sughd', districtId: 'ds_asht' })
    expect(prisma.kindergarten.findMany.mock.calls[1][0].where.AND[1]).toEqual({ districtId: 'ds_asht' })
  })

  it('итоги считаются по суммам, а не как среднее средних: крупная школа весит больше мелкой', async () => {
    const { total } = await service.overview(viewer, {})
    // оценки: 160 штук, сумма долей 119 -> 74.4 %; посещаемость: 1000+100 отметок, 990 присутствовали
    expect(total).toMatchObject({
      schools: 4, students: 450, teachers: 35, classes: 18, studentsPerTeacher: 12.9,
      gradesCount: 160, avgPercent: 74.4, schoolsWithGrades: 3, schoolsWithAttendance: 2,
    })
    expect(total.attendanceRate).toBe(90)
  })

  it('на главном экране: срез по областям, школы с низкими баллами и сколько школ не заполнили данные', async () => {
    const res = await service.overview(viewer, {})
    const sughdRow = res.regions.find((r) => r.region?.id === 'rg_sughd')!
    expect(sughdRow).toMatchObject({ schools: 2, students: 400, avgPercent: 73.3 })
    expect(res.regions.find((r) => r.region === null)).toMatchObject({ schools: 1 })
    expect(res.attention.map((a) => a.name)).toEqual(['Школа №2', 'Школа №1', 'Школа №3'])
    expect(res.noData).toEqual({ grades: 1, attendance: 2, teachers: 1, scaleMismatch: 0 })
  })

  it('сравнение районов: лучший район первым, район без данных — в конце', async () => {
    const { districts } = await service.districts(viewer, {})
    expect(districts.map((d) => d.district?.id ?? null)).toEqual(['ds_vakhsh', 'ds_asht', null])
    expect(districts[1]).toMatchObject({ schools: 2, students: 400, teachers: 25, studentsPerTeacher: 16 })
  })

  it('нет ни одной школы в охвате — пустые списки, запросы оценок не выполняются', async () => {
    prisma.kindergarten.findMany.mockResolvedValue([])
    const res = await service.overview(viewer, {})
    expect(res.total).toMatchObject({ schools: 0, students: 0, avgPercent: null, studentsPerTeacher: null })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('поиск по названию отбирает школы без учёта регистра', async () => {
    const { schools } = await service.schools(viewer, { q: 'без ДАННЫХ' })
    expect(schools.map((s) => s.id)).toEqual(['s4'])
  })

  it('директору школы сводка министерства недоступна', async () => {
    await expect(service.overview(director, {})).rejects.toThrow(ForbiddenException)
  })

  it('фильтры: наблюдатель района видит в списке только области и районы своего охвата', async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: true, role: 'VIEWER',
      viewerScope: { organization: 'Отдел Ашт', allSchools: false, regions: [], districts: [{ id: 'ds_asht' }] },
    })
    prisma.region.findMany.mockResolvedValue([
      { ...sughd, code: 'SUGHD', districts: [{ ...asht, code: 'SUGHD-ASHT', kind: 'DISTRICT' }, { id: 'ds_other', code: 'SUGHD-X', kind: 'DISTRICT', nameRu: 'Другой', nameTg: 'Дигар', nameEn: 'Other', sortOrder: 2 }] },
      { ...khatlon, code: 'KHATLON', districts: [{ ...vakhsh, code: 'KHATLON-VAKHSH', kind: 'DISTRICT' }] },
    ])
    const f = await service.filters(viewer)
    expect(f.organization).toBe('Отдел Ашт')
    expect(f.regions.map((r) => r.id)).toEqual(['rg_sughd'])
    expect(f.regions[0].districts.map((d) => d.id)).toEqual(['ds_asht'])
  })
})

describe('MinistryService: оценки выше шкалы школы', () => {
  let prisma: PrismaMock
  let service: MinistryService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new MinistryService(prisma as unknown as PrismaService, new MinistryScopeService(prisma as unknown as PrismaService))
    prisma.user.findUnique.mockResolvedValue({
      isActive: true, role: 'VIEWER', viewerScope: { organization: 'Министерство образования', allSchools: true, regions: [], districts: [] },
    })
    prisma.kindergarten.findMany.mockResolvedValue([school('s1', 'Школа №1', asht), school('s2', 'Школа №2', asht, 'TEN')])
    prisma.student.groupBy.mockResolvedValue([])
    prisma.user.groupBy.mockResolvedValue([])
    prisma.group.groupBy.mockResolvedValue([])
  })

  it('школа с оценками выше максимума шкалы получает флаг и попадает в счётчик на главном экране', async () => {
    // у s1 пятибалльная шкала, а оценки доходят до 10: 12 оценок выше максимума
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { schoolId: 's1', grades: 100, gradeShare: 170, good: 90, passed: 100, overScale: 12 },
        { schoolId: 's2', grades: 50, gradeShare: 30, good: 20, passed: 45, overScale: 0 },
      ])
      .mockResolvedValueOnce([])
    const { schools } = await service.schools(viewer, {})
    const byId = Object.fromEntries(schools.map((r) => [r.id, r]))
    expect(byId.s1.flags.scaleMismatch).toBe(true)
    expect(byId.s2.flags.scaleMismatch).toBe(false)

    prisma.$queryRaw
      .mockResolvedValueOnce([{ schoolId: 's1', grades: 100, gradeShare: 170, good: 90, passed: 100, overScale: 12 }])
      .mockResolvedValueOnce([])
    const overview = await service.overview(viewer, {})
    expect(overview.noData.scaleMismatch).toBe(1)
  })

  it('без признака overScale в ответе базы флаг не ставится', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ schoolId: 's1', grades: 10, gradeShare: 8, good: 7, passed: 9 }])
      .mockResolvedValueOnce([])
    const { schools } = await service.schools(viewer, {})
    expect(schools.every((r) => r.flags.scaleMismatch === false)).toBe(true)
  })
})

describe('MinistryService: динамика по неделям', () => {
  let prisma: PrismaMock
  let service: MinistryService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new MinistryService(prisma as unknown as PrismaService, new MinistryScopeService(prisma as unknown as PrismaService))
    prisma.user.findUnique.mockResolvedValue({
      isActive: true, role: 'VIEWER', viewerScope: { organization: 'Министерство образования', allSchools: true, regions: [], districts: [] },
    })
    prisma.kindergarten.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
  })

  it('собирает недели из оценок и посещаемости, по порядку; нет данных — null, а не ноль', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { week: '2026-10-19', grades: 50, gradeShare: 30, good: 20 }, // 60 %, качество 40 %
        { week: '2026-10-12', grades: 100, gradeShare: 80, good: 70 }, // 80 %, качество 70 %
      ])
      .mockResolvedValueOnce([
        { week: '2026-10-12', present: 90, absent: 5, sick: 5 }, // 90 %
        { week: '2026-10-26', present: 50, absent: 50, sick: 0 }, // 50 %, оценок нет
      ])
    const res = await service.trend(viewer, { from: '2026-10-12', to: '2026-10-30' })

    expect(res.period).toEqual({ from: '2026-10-12', to: '2026-10-30' })
    expect(res.weeks.map((w) => w.weekStart)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
    expect(res.weeks[0]).toEqual({ weekStart: '2026-10-12', gradesCount: 100, avgPercent: 80, quality: 70, attendanceMarks: 100, attendanceRate: 90 })
    expect(res.weeks[1]).toMatchObject({ avgPercent: 60, quality: 40, attendanceMarks: 0, attendanceRate: null })
    expect(res.weeks[2]).toMatchObject({ gradesCount: 0, avgPercent: null, quality: null, attendanceRate: 50 })
  })

  it('считает только школы охвата и сужается фильтром области, как и остальные экраны', async () => {
    prisma.$queryRaw.mockResolvedValue([])
    await service.trend(viewer, { regionId: 'rg_sughd' })
    expect(prisma.kindergarten.findMany.mock.calls[0][0].where).toEqual({
      AND: [{ isActive: true, isDemo: false, type: 'SCHOOL' }, { district: { regionId: 'rg_sughd' } }],
    })
  })

  it('нет школ в выборке — пустой ответ без запросов к оценкам и посещаемости', async () => {
    prisma.kindergarten.findMany.mockResolvedValue([])
    const res = await service.trend(viewer, {})
    expect(res.weeks).toEqual([])
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('учитель, директор школы и прочие роли динамику не видят', async () => {
    await expect(service.trend(director, {})).rejects.toThrow(ForbiddenException)
    await expect(service.trend({ ...director, role: 'TEACHER' }, {})).rejects.toThrow(ForbiddenException)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('кривой период — 400, а не пустой график', async () => {
    await expect(service.trend(viewer, { from: '2026-11-12', to: '2026-11-11' })).rejects.toThrow(BadRequestException)
  })

  it('в ответе только суммы по неделям', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ week: '2026-10-12', grades: 10, gradeShare: 8, good: 7 }])
      .mockResolvedValueOnce([{ week: '2026-10-12', present: 9, absent: 1, sick: 0 }])
    const json = JSON.stringify(await service.trend(viewer, {}))
    for (const forbidden of ['firstName', 'lastName', 'motherName', 'studentId', 'name']) expect(json).not.toContain(forbidden)
  })
})
