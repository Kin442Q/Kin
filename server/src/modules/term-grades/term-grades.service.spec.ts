import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'

import { TermGradesService } from './term-grades.service'
import { buildStudentTermReport } from './term-grade-report'
import { TermsService } from '../terms/terms.module'
import { ClassAccessService } from '../class-access/class-access.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

const teacher: AuthUser = {
  sub: 'teacher1',
  email: 't@school.tj',
  role: 'TEACHER',
  kindergartenId: 'kA',
  groupId: null,
  childId: null,
}
const admin: AuthUser = { ...teacher, sub: 'admin1', role: 'ADMIN' }

const d = (iso: string) => new Date(iso)
const term = { id: 'q2', name: '2 четверть', type: 'QUARTER', kindergartenId: 'kA', startDate: d('2026-11-09'), endDate: d('2026-12-27') }
const key = { termId: 'q2', subjectId: 'math', studentId: 'st1' }

/** Строка оценки учителя в памяти: пишет её только upsert, удаляет только deleteMany. */
type Row = { studentId: string; subjectId: string; termId: string; value: number; setById: string; setAt: Date }

/** Учитель ведёт класс g1 и предмет math; школа пятибалльная. */
function setup(options: { scale?: 'FIVE' | 'TEN' } = {}) {
  const prisma: PrismaMock = createPrismaMock()
  const service = new TermGradesService(
    prisma as unknown as PrismaService,
    new ClassAccessService(prisma as unknown as PrismaService),
  )
  const db = {
    rows: [] as Row[],
    grades: [] as { studentId: string; subjectId: string; value: number; date: Date }[],
  }

  prisma.term.findUnique.mockResolvedValue(term)
  prisma.subject.findUnique.mockResolvedValue({ id: 'math', kindergartenId: 'kA' })
  prisma.subject.findFirst.mockImplementation(async (a: { where: { id: string } }) => (a.where.id === 'math' ? { id: 'math' } : null))
  prisma.kindergarten.findUnique.mockResolvedValue({ gradeScale: options.scale ?? 'FIVE' })
  prisma.user.findUnique.mockResolvedValue({ groupId: 'g1', teachingGroups: [] })
  prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'kA' })
  prisma.student.findUnique.mockResolvedValue({ id: 'st1', groupId: 'g1', kindergartenId: 'kA' })
  prisma.student.findMany.mockResolvedValue([{ id: 'st1' }, { id: 'st2' }])
  prisma.grade.findMany.mockImplementation(async () => db.grades)
  prisma.termGrade.findMany.mockImplementation(async (a: { where: { studentId: { in: string[] } } }) =>
    db.rows.filter((r) => a.where.studentId.in.includes(r.studentId)).map((r) => ({ ...r, setBy: { id: r.setById, fullName: 'Мария' } })),
  )
  prisma.termGrade.upsert.mockImplementation(async (a: { create: Row; update: Partial<Row> }) => {
    const found = db.rows.find((r) => r.studentId === a.create.studentId)
    if (found) Object.assign(found, a.update)
    else db.rows.push({ ...a.create })
  })
  prisma.termGrade.deleteMany.mockImplementation(async (a: { where: { studentId: string } }) => {
    db.rows = db.rows.filter((r) => r.studentId !== a.where.studentId)
    return { count: 1 }
  })

  const mark = (studentId: string, value: number, date = '2026-11-12') =>
    db.grades.push({ studentId, subjectId: 'math', value, date: d(date) })
  const writes = () =>
    prisma.termGrade.upsert.mock.calls.length +
    prisma.termGrade.create.mock.calls.length +
    prisma.termGrade.update.mock.calls.length +
    prisma.termGrade.updateMany.mock.calls.length +
    prisma.termGrade.delete.mock.calls.length +
    prisma.termGrade.deleteMany.mock.calls.length

  return { prisma, service, db, mark, writes }
}

describe('TermGradesService — расчёт и оценка учителя', () => {
  it('расчёт берёт оценки только этого периода и предмета и ничего не пишет в базу', async () => {
    const { prisma, service, mark, writes } = setup()
    mark('st1', 4)
    mark('st1', 5)
    mark('st2', 3)

    const res = await service.list(teacher, { termId: 'q2', subjectId: 'math', groupId: 'g1' })

    expect(prisma.grade.findMany.mock.calls[0][0].where).toEqual({
      subjectId: 'math',
      studentId: { in: ['st1', 'st2'] },
      date: { gte: term.startDate, lte: term.endDate },
    })
    expect(res.scaleMax).toBe(5)
    expect(res.items[0]).toMatchObject({ studentId: 'st1', value: 5, source: 'SYSTEM', calculated: { average: 4.5, count: 2 } })
    expect(res.items[1]).toMatchObject({ studentId: 'st2', value: 3, source: 'SYSTEM' })
    expect(writes()).toBe(0)
  })

  it('оценка учителя не затирается расчётом, даже когда появляются новые оценки', async () => {
    const { service, db, mark, writes } = setup()
    mark('st1', 3)
    await service.set(teacher, { ...key, value: 5 })
    expect(db.rows).toEqual([expect.objectContaining({ studentId: 'st1', value: 5, setById: 'teacher1' })])
    const written = { ...db.rows[0] }
    const writesAfterSet = writes()

    // после этого учитель ставит двойки — расчёт падает
    mark('st1', 2, '2026-11-20')
    mark('st1', 2, '2026-11-21')
    const res = await service.list(teacher, { termId: 'q2', subjectId: 'math', groupId: 'g1' })

    expect(res.items[0]).toMatchObject({ value: 5, source: 'TEACHER', calculated: { value: 2, count: 3 } })
    expect(db.rows).toEqual([written])
    expect(writes()).toBe(writesAfterSet)
  })

  it('«сбросить» убирает оценку учителя — снова действует расчёт', async () => {
    const { service, db, mark } = setup()
    mark('st1', 3)
    mark('st1', 4)
    await service.set(teacher, { ...key, value: 2 })

    const res = await service.reset(teacher, key)

    expect(db.rows).toEqual([])
    expect(res.item).toMatchObject({ value: 4, source: 'SYSTEM', manual: null })
  })

  it('изменение обновляет значение, автора и дату; ключ — ученик, предмет и период', async () => {
    const { prisma, service, db } = setup()
    await service.set(teacher, { ...key, value: 3 })
    const first = db.rows[0].setAt
    const res = await service.set(teacher, { ...key, value: 4 })

    expect(db.rows).toHaveLength(1)
    expect(res.item).toMatchObject({ value: 4, source: 'TEACHER' })
    const call = prisma.termGrade.upsert.mock.calls[1][0]
    expect(call.where).toEqual({ studentId_subjectId_termId: { studentId: 'st1', subjectId: 'math', termId: 'q2' } })
    expect(call.update).toMatchObject({ value: 4, setById: 'teacher1' })
    expect(call.update.setAt.getTime()).toBeGreaterThanOrEqual(first.getTime())
  })

  it('оценка вне шкалы школы — 400; в десятибалльной школе 8 принимается', async () => {
    const five = setup()
    await expect(five.service.set(teacher, { ...key, value: 8 })).rejects.toThrow(BadRequestException)
    await expect(five.service.set(teacher, { ...key, value: 0 })).rejects.toThrow('от 1 до 5')
    expect(five.writes()).toBe(0)

    const ten = setup({ scale: 'TEN' })
    const res = await ten.service.set(teacher, { ...key, value: 8 })
    expect(res).toMatchObject({ scaleMax: 10, item: { value: 8, source: 'TEACHER' } })
  })

  describe('кто может', () => {
    it('директор и администратор видят итоги, но не ставят и не сбрасывают', async () => {
      const { service, writes } = setup()
      for (const who of [admin, { ...admin, role: 'SUPER_ADMIN' } as AuthUser]) {
        await expect(service.list(who, { termId: 'q2', subjectId: 'math', groupId: 'g1' })).resolves.toBeDefined()
        await expect(service.set(who, { ...key, value: 4 })).rejects.toThrow('Итог четверти ставит только учитель')
        await expect(service.reset(who, key)).rejects.toThrow(ForbiddenException)
      }
      expect(writes()).toBe(0)
    })

    it('учитель — не по чужому предмету', async () => {
      const { prisma, service, writes } = setup()
      prisma.subject.findUnique.mockResolvedValue({ id: 'art', kindergartenId: 'kA' })
      await expect(service.set(teacher, { ...key, subjectId: 'art', value: 4 })).rejects.toThrow('Этот предмет вам не выдан')
      await expect(service.list(teacher, { termId: 'q2', subjectId: 'art', groupId: 'g1' })).rejects.toThrow(ForbiddenException)
      expect(writes()).toBe(0)
    })

    it('учитель — не ученику чужого класса и не по чужому классу', async () => {
      const { prisma, service, writes } = setup()
      prisma.student.findUnique.mockResolvedValue({ id: 'st9', groupId: 'g9', kindergartenId: 'kA' })
      await expect(service.set(teacher, { ...key, studentId: 'st9', value: 4 })).rejects.toThrow('Ученик не из ваших классов')
      await expect(service.reset(teacher, { ...key, studentId: 'st9' })).rejects.toThrow(ForbiddenException)
      prisma.group.findUnique.mockResolvedValue({ id: 'g9', kindergartenId: 'kA' })
      await expect(service.list(teacher, { termId: 'q2', subjectId: 'math', groupId: 'g9' })).rejects.toThrow('Это не ваш класс')
      expect(writes()).toBe(0)
    })

    it('период, предмет, ученик или класс другой школы — 403', async () => {
      const { prisma, service, writes } = setup()
      prisma.term.findUnique.mockResolvedValue({ ...term, kindergartenId: 'kB' })
      await expect(service.set(teacher, { ...key, value: 4 })).rejects.toThrow('Объект из другого учреждения')

      prisma.term.findUnique.mockResolvedValue(term)
      prisma.student.findUnique.mockResolvedValue({ id: 'st1', groupId: 'g1', kindergartenId: 'kB' })
      await expect(service.set(teacher, { ...key, value: 4 })).rejects.toThrow('Объект из другого учреждения')

      prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'kB' })
      await expect(service.list(admin, { termId: 'q2', subjectId: 'math', groupId: 'g1' })).rejects.toThrow(ForbiddenException)
      expect(writes()).toBe(0)
    })
  })
})

describe('удаление учебного периода', () => {
  function setupTerms(marks: number) {
    const prisma: PrismaMock = createPrismaMock()
    prisma.term.findUnique.mockResolvedValue(term)
    prisma.termGrade.count.mockResolvedValue(marks)
    return { prisma, service: new TermsService(prisma as unknown as PrismaService) }
  }

  it('период с оценками учителей не удаляется: они пропали бы вместе с ним', async () => {
    const { prisma, service } = setupTerms(3)
    await expect(service.remove(admin, 'q2')).rejects.toThrow(ConflictException)
    expect(prisma.termGrade.count).toHaveBeenCalledWith({ where: { termId: 'q2' } })
    expect(prisma.term.delete).not.toHaveBeenCalled()
  })

  it('без них удаляется как раньше', async () => {
    const { prisma, service } = setupTerms(0)
    await service.remove(admin, 'q2')
    expect(prisma.term.delete).toHaveBeenCalledWith({ where: { id: 'q2' } })
  })
})

describe('итоги четвертей для ученика и родителя', () => {
  const subject = (id: string, name: string) => ({ id, name, color: '#000000' })
  const terms = [
    { id: 'q1', name: '1 четверть', type: 'QUARTER', kindergartenId: 'kA', startDate: d('2026-09-01'), endDate: d('2026-11-01') },
    term,
    { id: 'q9', name: '4 четверть', type: 'QUARTER', kindergartenId: 'kA', startDate: d('2099-04-01'), endDate: d('2099-05-31') },
  ]
  const g = (subjectId: string, name: string, value: number, date: string) => ({
    subjectId,
    value,
    date: d(date),
    subject: subject(subjectId, name),
  })

  function report(grades: unknown[], manual: unknown[], scale: 'FIVE' | 'TEN' = 'FIVE') {
    const prisma: PrismaMock = createPrismaMock()
    prisma.kindergarten.findUnique.mockResolvedValue({ gradeScale: scale })
    prisma.term.findMany.mockResolvedValue(terms)
    prisma.grade.findMany.mockResolvedValue(grades)
    prisma.termGrade.findMany.mockResolvedValue(manual)
    return { prisma, run: () => buildStudentTermReport(prisma as unknown as PrismaService, { id: 'st1', kindergartenId: 'kA' }) }
  }

  it('по периодам и предметам: расчётные и поставленные учителем отмечены', async () => {
    const { prisma, run } = report(
      [
        g('math', 'Математика', 5, '2026-09-10'),
        g('math', 'Математика', 4, '2026-10-10'),
        g('rus', 'Алгебра', 3, '2026-11-12'),
        g('math', 'Математика', 2, '2026-11-15'),
        g('math', 'Математика', 3, '2026-11-05'), // между четвертями — никуда
      ],
      [{ termId: 'q2', subjectId: 'math', value: 4, setAt: d('2026-11-25T09:00:00Z'), subject: subject('math', 'Математика') }],
    )
    const res = await run()

    expect(prisma.grade.findMany.mock.calls[0][0].where.studentId).toBe('st1')
    expect(prisma.termGrade.findMany.mock.calls[0][0].where.studentId).toBe('st1')
    expect(res.scaleMax).toBe(5)
    expect(res.terms.map((t) => t.id)).toEqual(['q1', 'q2']) // будущий период без итогов не показываем
    expect(res.terms[0].subjects).toEqual([
      expect.objectContaining({ value: 5, source: 'SYSTEM', average: 4.5, count: 2, date: '2026-10-10' }),
    ])
    // предметы по алфавиту; у математики действует оценка учителя, хотя расчёт — 2
    expect(res.terms[1].subjects.map((s) => [s.subject.name, s.value, s.source])).toEqual([
      ['Алгебра', 3, 'SYSTEM'],
      ['Математика', 4, 'TEACHER'],
    ])
    expect(res.terms[0].startDate).toBe('2026-09-01')
  })

  it('оценка учителя по предмету без обычных оценок тоже видна', async () => {
    const { run } = report(
      [],
      [{ termId: 'q1', subjectId: 'art', value: 5, setAt: d('2026-10-30T09:00:00Z'), subject: subject('art', 'Рисование') }],
    )
    const res = await run()
    expect(res.terms).toHaveLength(1)
    expect(res.terms[0].subjects[0]).toMatchObject({ value: 5, source: 'TEACHER', count: 0, average: null })
  })

  it('оценки вне шкалы без оценки учителя не показываются', async () => {
    const { run } = report([g('math', 'Математика', 9, '2026-11-12')], [])
    expect((await run()).terms).toEqual([])
  })

  it('ученик без школы — пусто, чужие периоды не читаются', async () => {
    const prisma: PrismaMock = createPrismaMock()
    const res = await buildStudentTermReport(prisma as unknown as PrismaService, { id: 'st1', kindergartenId: null })
    expect(res.terms).toEqual([])
    expect(prisma.term.findMany).not.toHaveBeenCalled()
  })
})
