import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'

import { AttendanceService } from './attendance.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const adminK1: AuthUser = {
  sub: 'admin',
  email: 'admin@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}

const teacherK1: AuthUser = {
  sub: 't',
  email: 't@kg.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: 'g1',
  childId: null,
}

describe('AttendanceService', () => {
  let service: AttendanceService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { delByPattern: jest.fn() } },
      ],
    }).compile()
    service = ref.get(AttendanceService)
  })

  describe('listByDay', () => {
    it('TEACHER без groupId — пустой массив', async () => {
      const res = await service.listByDay(
        { ...teacherK1, groupId: null },
        { date: '2026-05-14' },
      )
      expect(res).toEqual([])
    })

    it('TEACHER принудительно фильтрует по своей группе', async () => {
      prisma.attendance.findMany.mockResolvedValue([])
      await service.listByDay(teacherK1, {
        date: '2026-05-14',
        groupId: 'g999', // игнорируется
      })

      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: 'g1' }),
        }),
      )
    })

    it('ADMIN фильтрует по садику через student', async () => {
      prisma.attendance.findMany.mockResolvedValue([])
      await service.listByDay(adminK1, { date: '2026-05-14' })

      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { kindergartenId: 'k1' },
          }),
        }),
      )
    })
  })

  describe('mark', () => {
    const dto = {
      studentId: 's1',
      date: '2026-05-14',
      status: 'PRESENT' as const,
    }

    it('404 если ученик не найден', async () => {
      prisma.student.findUnique.mockResolvedValue(null)
      await expect(service.mark(adminK1, dto)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('403 если ученик из другого садика', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k2',
      })
      await expect(service.mark(adminK1, dto)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('403 TEACHER не может отметить ребёнка чужой группы', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g999',
        kindergartenId: 'k1',
      })
      await expect(service.mark(teacherK1, dto)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('успешно делает upsert', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
      })
      prisma.attendance.upsert.mockResolvedValue({
        id: 'a1',
        status: 'PRESENT',
      })

      const res = await service.mark(teacherK1, dto)
      expect(res.status).toBe('PRESENT')
      expect(prisma.attendance.upsert).toHaveBeenCalled()
    })

    it('сохраняет markedById = текущий пользователь', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
      })
      prisma.attendance.upsert.mockResolvedValue({})

      await service.mark(teacherK1, dto)

      expect(prisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ markedById: 't' }),
          update: expect.objectContaining({ markedById: 't' }),
        }),
      )
    })
  })
})
