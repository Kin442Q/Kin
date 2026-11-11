import { ForbiddenException } from '@nestjs/common'

import { SchoolService } from './school.module'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
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

/** Учитель ведёт класс g1 и имеет доступ только к предмету math. */
function setup() {
  const prisma: PrismaMock = createPrismaMock()
  const push = { sendToStudentParents: jest.fn().mockResolvedValue(undefined), sendToGroupParents: jest.fn().mockResolvedValue(undefined) }
  const service = new SchoolService(prisma as never, push as never)
  prisma.user.findUnique.mockResolvedValue({ groupId: 'g1', teachingGroups: [] })
  // выданные предметы: запрос по teachers.some → только math
  prisma.subject.findMany.mockImplementation(async (args: { where?: { teachers?: unknown } }) =>
    args?.where?.teachers ? [{ id: 'math', name: 'Математика', color: '#000' }] : [{ id: 'math' }, { id: 'art' }],
  )
  return { prisma, service }
}

describe('SchoolService — учитель работает только с выданными предметами', () => {
  it('список предметов учителя фильтруется по выданным, админа — нет', async () => {
    const { prisma, service } = setup()
    await service.listSubjects(teacher)
    expect(prisma.subject.findMany.mock.calls[0][0].where).toEqual({
      kindergartenId: 'kA',
      teachers: { some: { id: 'teacher1' } },
    })

    prisma.subject.findMany.mockClear()
    await service.listSubjects(admin)
    expect(prisma.subject.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'kA' })
  })

  it('оценка по невыданному предмету — 403, в БД ничего не пишется', async () => {
    const { prisma, service } = setup()
    prisma.student.findUnique.mockResolvedValue({ id: 'st1', groupId: 'g1', kindergartenId: 'kA' })
    prisma.subject.findUnique.mockResolvedValue({ id: 'art', kindergartenId: 'kA' })
    await expect(
      service.upsertGrade(teacher, { studentId: 'st1', subjectId: 'art', value: 5, date: '2026-11-05' } as never),
    ).rejects.toThrow(ForbiddenException)
    expect(prisma.grade.create).not.toHaveBeenCalled()
  })

  it('оценка по выданному предмету и своему классу проходит', async () => {
    const { prisma, service } = setup()
    prisma.student.findUnique.mockResolvedValue({ id: 'st1', groupId: 'g1', kindergartenId: 'kA' })
    prisma.subject.findUnique.mockResolvedValue({ id: 'math', kindergartenId: 'kA' })
    prisma.grade.create.mockResolvedValue({ id: 'gr1', subject: { name: 'Математика' } })
    await service.upsertGrade(teacher, { studentId: 'st1', subjectId: 'math', value: 5, date: '2026-11-05' } as never)
    expect(prisma.grade.create).toHaveBeenCalled()
  })

  it('ученик не из его классов — по-прежнему 403, даже при выданном предмете', async () => {
    const { prisma, service } = setup()
    prisma.student.findUnique.mockResolvedValue({ id: 'st9', groupId: 'g9', kindergartenId: 'kA' })
    prisma.subject.findUnique.mockResolvedValue({ id: 'math', kindergartenId: 'kA' })
    await expect(
      service.upsertGrade(teacher, { studentId: 'st9', subjectId: 'math', value: 5, date: '2026-11-05' } as never),
    ).rejects.toThrow(ForbiddenException)
  })

  it('админ ставит оценку по любому предмету школы', async () => {
    const { prisma, service } = setup()
    prisma.student.findUnique.mockResolvedValue({ id: 'st1', groupId: 'g1', kindergartenId: 'kA' })
    prisma.subject.findUnique.mockResolvedValue({ id: 'art', kindergartenId: 'kA' })
    prisma.grade.create.mockResolvedValue({ id: 'gr1', subject: { name: 'Рисование' } })
    await service.upsertGrade(admin, { studentId: 'st1', subjectId: 'art', value: 4, date: '2026-11-05' } as never)
    expect(prisma.grade.create).toHaveBeenCalled()
  })

  it('чтение оценок: чужой предмет по id не отдаётся, без subjectId — только выданные', async () => {
    const { prisma, service } = setup()
    prisma.grade.findMany.mockResolvedValue([])
    expect(await service.listGrades(teacher, { subjectId: 'art' })).toEqual([])
    expect(prisma.grade.findMany).not.toHaveBeenCalled()

    await service.listGrades(teacher, {})
    expect(prisma.grade.findMany.mock.calls[0][0].where.subjectId).toEqual({ in: ['math'] })
  })

  it('ДЗ по невыданному предмету — 403', async () => {
    const { prisma, service } = setup()
    prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'kA' })
    await expect(
      service.createHomework(teacher, { groupId: 'g1', subjectId: 'art', title: 'x', dueDate: '2026-11-06' } as never),
    ).rejects.toThrow(ForbiddenException)
    expect(prisma.homework.create).not.toHaveBeenCalled()
  })
})
