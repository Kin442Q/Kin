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

function setup() {
  const prisma: PrismaMock = createPrismaMock()
  const push = { sendToStudentParents: jest.fn(), sendToGroupParents: jest.fn() }
  const service = new SchoolService(prisma as never, push as never)
  // учитель ведёт 6Б и 5А, ему выданы предметы math и geo
  prisma.user.findUnique.mockResolvedValue({ groupId: 'g6b', teachingGroups: [{ id: 'g5a' }] })
  prisma.subject.findMany.mockResolvedValue([{ id: 'math' }, { id: 'geo' }])
  return { prisma, service }
}

const hw = (id: string, groupId: string) => ({ id, groupId, title: id, dueDate: new Date('2026-11-10'), subject: { id: 'math' } })

describe('SchoolService.listHomework — сколько учеников сдали каждое ДЗ', () => {
  it('считает «сдали» (сам отметил + вердикт учителя) и «ждут проверки», а размер класса берёт по активным ученикам', async () => {
    const { prisma, service } = setup()
    prisma.homework.findMany.mockResolvedValue([hw('h1', 'g6b'), hw('h2', 'g5a')])
    prisma.homeworkSubmission.groupBy.mockResolvedValue([
      { homeworkId: 'h1', status: 'SUBMITTED', _count: { _all: 5 } },
      { homeworkId: 'h1', status: 'DONE', _count: { _all: 10 } },
      { homeworkId: 'h1', status: 'PARTIAL', _count: { _all: 2 } },
      { homeworkId: 'h1', status: 'NOT_DONE', _count: { _all: 3 } },
      { homeworkId: 'h2', status: 'SUBMITTED', _count: { _all: 1 } },
    ])
    prisma.student.groupBy.mockResolvedValue([
      { groupId: 'g6b', _count: { _all: 24 } },
      { groupId: 'g5a', _count: { _all: 26 } },
    ])

    const list = await service.listHomework(teacher, {})

    expect(list.map((h) => [h.id, h.stats])).toEqual([
      ['h1', { total: 24, submitted: 17, toCheck: 5 }],
      ['h2', { total: 26, submitted: 1, toCheck: 1 }],
    ])
    // «не выполнено» не считается сданным
    expect(prisma.homeworkSubmission.groupBy.mock.calls[0][0].where).toEqual({ homeworkId: { in: ['h1', 'h2'] } })
    expect(prisma.student.groupBy.mock.calls[0][0].where).toEqual({ groupId: { in: ['g6b', 'g5a'] }, status: 'ACTIVE' })
  })

  it('ДЗ без единой отметки: все нули, а размер класса виден', async () => {
    const { prisma, service } = setup()
    prisma.homework.findMany.mockResolvedValue([hw('h1', 'g6b')])
    prisma.homeworkSubmission.groupBy.mockResolvedValue([])
    prisma.student.groupBy.mockResolvedValue([{ groupId: 'g6b', _count: { _all: 24 } }])

    const [h] = await service.listHomework(teacher, {})

    expect(h.stats).toEqual({ total: 24, submitted: 0, toCheck: 0 })
  })

  it('пустой список не делает лишних запросов в базу', async () => {
    const { prisma, service } = setup()
    prisma.homework.findMany.mockResolvedValue([])

    await expect(service.listHomework(teacher, {})).resolves.toEqual([])

    expect(prisma.homeworkSubmission.groupBy).not.toHaveBeenCalled()
    expect(prisma.student.groupBy).not.toHaveBeenCalled()
  })
})
