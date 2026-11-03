import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { HomeroomService } from './homeroom.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { ClassAccessService } from '../class-access/class-access.service'
import type { ParentNoticeService } from '../parent-notice/parent-notice.service'
import type { FeaturesService } from '../features/features.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const teacher: AuthUser = {
  sub: 't1',
  email: 't@s.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}
const group = { id: 'g1', name: '5А', kindergartenId: 'k1', homeroomTeacherId: 't1' }

describe('HomeroomService', () => {
  let prisma: PrismaMock
  let access: { assertHomeroomAccess: jest.Mock; isAdmin: jest.Mock }
  let notice: { parentIdsByStudent: jest.Mock; notify: jest.Mock }
  let features: { isEnabled: jest.Mock }
  let service: HomeroomService

  beforeEach(() => {
    prisma = createPrismaMock()
    access = {
      assertHomeroomAccess: jest.fn().mockResolvedValue(undefined),
      isAdmin: jest.fn((u: AuthUser) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'),
    }
    notice = {
      parentIdsByStudent: jest.fn().mockResolvedValue(new Map([['a', ['p1']]])),
      notify: jest.fn().mockResolvedValue({ sent: 1 }),
    }
    features = { isEnabled: jest.fn().mockResolvedValue(true) }
    service = new HomeroomService(
      prisma as unknown as PrismaService,
      access as unknown as ClassAccessService,
      notice as unknown as ParentNoticeService,
      features as unknown as FeaturesService,
    )
    prisma.group.findUnique.mockResolvedValue(group)
  })

  describe('mine', () => {
    it('учитель видит только классы, где он руководитель', async () => {
      prisma.group.findMany.mockResolvedValue([
        { id: 'g1', name: '5А', homeroomTeacher: { id: 't1', fullName: 'Я' }, _count: { students: 24 } },
      ])
      const r = await service.mine(teacher)
      expect(prisma.group.findMany.mock.calls[0][0].where).toEqual({ homeroomTeacherId: 't1', isActive: true })
      expect(r).toEqual([{ id: 'g1', name: '5А', homeroomTeacher: { id: 't1', fullName: 'Я' }, studentsCount: 24 }])
    })

    it('админ школы видит все классы своей школы', async () => {
      prisma.group.findMany.mockResolvedValue([])
      await service.mine({ ...teacher, role: 'ADMIN', sub: 'a1' })
      expect(prisma.group.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1', isActive: true })
    })
  })

  describe('overview', () => {
    const students = [
      { id: 'a', firstName: 'Али', lastName: 'А', photoUrl: null },
      { id: 'b', firstName: 'Баха', lastName: 'Б', photoUrl: null },
    ]
    beforeEach(() => {
      prisma.student.findMany.mockResolvedValue(students)
      prisma.homework.findMany.mockResolvedValue([{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }])
      prisma.homeworkSubmission.findMany.mockResolvedValue([
        { studentId: 'a', status: 'DONE' },
        { studentId: 'a', status: 'NOT_DONE' },
        { studentId: 'b', status: 'NOT_DONE' },
        { studentId: 'b', status: 'NOT_DONE' },
        { studentId: 'b', status: 'SUBMITTED' },
      ])
      prisma.attendance.findMany.mockResolvedValue([
        { studentId: 'a', status: 'PRESENT' },
        { studentId: 'a', status: 'ABSENT' },
        { studentId: 'b', status: 'SICK' },
      ])
      prisma.grade.findMany.mockResolvedValue([
        { studentId: 'a', value: 5 },
        { studentId: 'a', value: 4 },
      ])
    })

    it('проверяет права классного руководителя на этот класс', async () => {
      access.assertHomeroomAccess.mockRejectedValue(new ForbiddenException())
      await expect(service.overview(teacher, 'g1', 14)).rejects.toThrow(ForbiddenException)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
    })

    it('несуществующий класс → 404', async () => {
      prisma.group.findUnique.mockResolvedValue(null)
      await expect(service.overview(teacher, 'nope', 14)).rejects.toThrow(NotFoundException)
    })

    it('считает ДЗ, посещаемость и средний балл по каждому ученику', async () => {
      const r = await service.overview(teacher, 'g1', 14)

      expect(r.homeworkCount).toBe(3)
      const a = r.students.find((x) => x.student.id === 'a')!
      const b = r.students.find((x) => x.student.id === 'b')!
      expect(a.homework).toEqual({ total: 3, done: 1, partial: 0, notDone: 1, submitted: 0, unmarked: 1 })
      expect(b.homework).toEqual({ total: 3, done: 0, partial: 0, notDone: 2, submitted: 1, unmarked: 0 })
      expect(a.attendance).toEqual({ present: 1, absent: 1, sick: 0, vacation: 0 })
      expect(b.attendance).toEqual({ present: 0, absent: 0, sick: 1, vacation: 0 })
      expect(a.grades).toEqual({ count: 2, average: 4.5 })
      expect(b.grades).toEqual({ count: 0, average: null })
      expect(a.parentsCount).toBe(1)
      expect(b.parentsCount).toBe(0)
    })

    it('данные выключенных разделов не отдаются и не запрашиваются', async () => {
      features.isEnabled.mockImplementation(async (_k: string, key: string) => key === 'homework')
      const r = await service.overview(teacher, 'g1', 14)

      expect(r.sections).toEqual({ homework: true, attendance: false, grades: false })
      expect(r.students[0].attendance).toBeNull()
      expect(r.students[0].grades).toBeNull()
      expect(prisma.attendance.findMany).not.toHaveBeenCalled()
      expect(prisma.grade.findMany).not.toHaveBeenCalled()
    })

    it('период ограничен: от 1 до 90 дней', async () => {
      expect((await service.overview(teacher, 'g1', 0)).days).toBe(14) // нечисло/0 → по умолчанию
      expect((await service.overview(teacher, 'g1', 5000)).days).toBe(90)
      expect((await service.overview(teacher, 'g1', -3)).days).toBe(1)
    })
  })

  describe('notify', () => {
    it('пустой текст → 400', async () => {
      await expect(service.notify(teacher, 'g1', ['a'], '   ')).rejects.toThrow(BadRequestException)
    })

    it('ученик не из этого класса → 400, никому не отправлено', async () => {
      prisma.student.count.mockResolvedValue(1)
      await expect(service.notify(teacher, 'g1', ['a', 'foreign'], 'Здравствуйте')).rejects.toThrow(
        BadRequestException,
      )
      expect(notice.notify).not.toHaveBeenCalled()
    })

    it('отправляет каждому, считает тех, у кого нет родителей', async () => {
      prisma.student.count.mockResolvedValue(3)
      notice.notify.mockImplementation(async (_u: AuthUser, id: string) => ({ sent: id === 'c' ? 0 : 2 }))
      const r = await service.notify(teacher, 'g1', ['a', 'b', 'c', 'a'], '  Просим зайти в школу ')
      expect(notice.notify).toHaveBeenCalledTimes(3) // дубль 'a' убран
      expect(notice.notify.mock.calls[0][2]).toBe('Просим зайти в школу')
      expect(r).toEqual({ notified: 2, sent: 4, skipped: [{ studentId: 'c', reason: 'NO_PARENTS' }] })
    })
  })
})
