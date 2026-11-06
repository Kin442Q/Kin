import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { ScheduleService } from './schedule.module'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base: Omit<AuthUser, 'sub' | 'role'> = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const admin: AuthUser = { ...base, sub: 'adm', role: 'ADMIN' }
const adminOtherSchool: AuthUser = { ...base, sub: 'adm2', role: 'ADMIN', kindergartenId: 'k2' }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }

const lesson = (patch: Record<string, unknown> = {}) => ({ startTime: '08:00', endTime: '08:45', subjectId: 'math', ...patch })

function setup() {
  const prisma: PrismaMock = createPrismaMock()
  const service = new ScheduleService(prisma as never)
  prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'k1' })
  prisma.subject.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({ id, name: id === 'math' ? 'Математика' : 'Рисование' })),
  )
  prisma.user.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id })))
  prisma.scheduleItem.findMany.mockResolvedValue([])
  prisma.scheduleItem.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
  prisma.scheduleItem.deleteMany.mockResolvedValue({ count: 0 })
  prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  // учитель ведёт класс g1
  prisma.user.findUnique.mockResolvedValue({ groupId: 'g1', teachingGroups: [] })
  return { prisma, service }
}

describe('ScheduleService.createBulk — сразу много уроков', () => {
  it('список уроков × выбранные дни: одна запись на каждый урок и день, название берётся из предмета', async () => {
    const { prisma, service } = setup()

    const res = await service.createBulk(admin, {
      groupId: 'g1',
      days: [3, 1, 3],
      lessons: [lesson(), lesson({ startTime: '08:55', endTime: '09:40', subjectId: 'art', teacherId: 'u9', room: ' 304 ' })],
    })

    expect(res).toEqual({ created: 4, skipped: 0, replaced: 0 })
    const data = prisma.scheduleItem.createMany.mock.calls[0][0].data
    expect(data).toHaveLength(4)
    expect(data.map((d: { dayOfWeek: number }) => d.dayOfWeek)).toEqual([1, 1, 3, 3]) // дни без повторов и по порядку
    expect(data[0]).toMatchObject({ groupId: 'g1', startTime: '08:00', endTime: '08:45', activity: 'Математика', subjectId: 'math', teacherId: null, room: null })
    expect(data[1]).toMatchObject({ activity: 'Рисование', subjectId: 'art', teacherId: 'u9', room: '304' })
    expect(prisma.scheduleItem.deleteMany).not.toHaveBeenCalled()
  })

  it('точные повторы пропускаются, а не дублируются', async () => {
    const { prisma, service } = setup()
    prisma.scheduleItem.findMany.mockResolvedValue([
      { dayOfWeek: 1, startTime: '08:00', endTime: '08:45', subjectId: 'math', activity: 'Математика' },
    ])

    const res = await service.createBulk(admin, {
      groupId: 'g1',
      days: [1, 2],
      lessons: [lesson()],
    })

    expect(res).toEqual({ created: 1, skipped: 1, replaced: 0 }) // понедельник уже есть, вторник добавлен
    expect(prisma.scheduleItem.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ dayOfWeek: 2 })])
  })

  it('replace: сначала убирает уроки класса в выбранные дни, потом добавляет всё заново', async () => {
    const { prisma, service } = setup()
    prisma.scheduleItem.findMany.mockResolvedValue([
      { dayOfWeek: 1, startTime: '08:00', endTime: '08:45', subjectId: 'math', activity: 'Математика' },
      { dayOfWeek: 1, startTime: '09:00', endTime: '09:45', subjectId: 'art', activity: 'Рисование' },
    ])

    const res = await service.createBulk(admin, { groupId: 'g1', days: [1], replace: true, lessons: [lesson()] })

    expect(res).toEqual({ created: 1, skipped: 0, replaced: 2 })
    expect(prisma.scheduleItem.deleteMany).toHaveBeenCalledWith({ where: { groupId: 'g1', dayOfWeek: { in: [1] } } })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1) // всё в одной транзакции
  })

  it('уроки не могут пересекаться по времени, конец позже начала', async () => {
    const { prisma, service } = setup()

    await expect(
      service.createBulk(admin, { groupId: 'g1', days: [1], lessons: [lesson(), lesson({ startTime: '08:30', endTime: '09:15' })] }),
    ).rejects.toThrow(/пересекаются/)
    await expect(
      service.createBulk(admin, { groupId: 'g1', days: [1], lessons: [lesson({ startTime: '09:00', endTime: '08:00' })] }),
    ).rejects.toThrow(BadRequestException)
    expect(prisma.scheduleItem.createMany).not.toHaveBeenCalled()
  })

  it('урок без предмета и без названия — 400; с названием (без предмета) проходит', async () => {
    const { prisma, service } = setup()
    await expect(
      service.createBulk(admin, { groupId: 'g1', days: [1], lessons: [lesson({ subjectId: undefined })] }),
    ).rejects.toThrow(/выберите предмет/)

    await service.createBulk(admin, { groupId: 'g1', days: [1], lessons: [lesson({ subjectId: undefined, activity: ' Прогулка ' })] })
    expect(prisma.scheduleItem.createMany.mock.calls[0][0].data[0]).toMatchObject({ activity: 'Прогулка', subjectId: null })
  })

  it('предмет или учитель из другой школы — 404, ничего не пишется', async () => {
    const { prisma, service } = setup()
    prisma.subject.findMany.mockResolvedValue([]) // в школе такого предмета нет
    await expect(service.createBulk(admin, { groupId: 'g1', days: [1], lessons: [lesson()] })).rejects.toThrow(NotFoundException)

    prisma.subject.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id, name: 'X' })))
    prisma.user.findMany.mockResolvedValue([])
    await expect(
      service.createBulk(admin, { groupId: 'g1', days: [1], lessons: [lesson({ teacherId: 'stranger' })] }),
    ).rejects.toThrow(NotFoundException)
    expect(prisma.scheduleItem.createMany).not.toHaveBeenCalled()
  })

  it('доступ: админ другой школы — 403; учитель — только своему классу', async () => {
    const { prisma, service } = setup()
    await expect(service.createBulk(adminOtherSchool, { groupId: 'g1', days: [1], lessons: [lesson()] })).rejects.toThrow(ForbiddenException)

    await expect(service.createBulk(teacher, { groupId: 'g1', days: [1], lessons: [lesson()] })).resolves.toMatchObject({ created: 1 })

    prisma.group.findUnique.mockResolvedValue({ id: 'g2', kindergartenId: 'k1' })
    await expect(service.createBulk(teacher, { groupId: 'g2', days: [1], lessons: [lesson()] })).rejects.toThrow(ForbiddenException)
  })

  it('несуществующий класс — 404', async () => {
    const { prisma, service } = setup()
    prisma.group.findUnique.mockResolvedValue(null)
    await expect(service.createBulk(admin, { groupId: 'nope', days: [1], lessons: [lesson()] })).rejects.toThrow(NotFoundException)
  })
})
