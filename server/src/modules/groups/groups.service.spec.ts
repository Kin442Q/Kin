import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'

import { GroupsService } from './groups.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const adminUser: AuthUser = {
  sub: 'u1',
  email: 'admin@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}

const teacherUser: AuthUser = {
  sub: 'u2',
  email: 't@kg.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: 'g1',
  childId: null,
}

const globalOwner: AuthUser = {
  sub: 'u3',
  email: 'owner@kg.tj',
  role: 'SUPER_ADMIN',
  kindergartenId: null,
  groupId: null,
  childId: null,
}

describe('GroupsService', () => {
  let service: GroupsService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RedisService,
          useValue: {
            del: jest.fn(),
            delByPattern: jest.fn(),
            wrap: jest.fn((_k, _ttl, fn) => fn()),
          },
        },
      ],
    }).compile()
    service = ref.get(GroupsService)
  })

  describe('findAll', () => {
    it('TEACHER видит только свою группу', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        name: 'Солнышко',
      })

      const res = await service.findAll(teacherUser)

      expect(res).toHaveLength(1)
      expect(prisma.group.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'g1' } }),
      )
    })

    it('TEACHER без groupId — пустой массив', async () => {
      const res = await service.findAll({ ...teacherUser, groupId: null })
      expect(res).toEqual([])
    })

    it('ADMIN видит только группы своего садика', async () => {
      prisma.group.findMany.mockResolvedValue([])
      await service.findAll(adminUser)

      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { kindergartenId: 'k1' } }),
      )
    })

    it('Глобальный супер-админ видит все группы', async () => {
      prisma.group.findMany.mockResolvedValue([])
      await service.findAll(globalOwner)

      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })
  })

  describe('findOne', () => {
    it('404 если группа не найдена', async () => {
      prisma.group.findUnique.mockResolvedValue(null)
      await expect(service.findOne(adminUser, 'gX')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('403 если группа из другого садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k2',
      })
      await expect(service.findOne(adminUser, 'g1')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('возвращает группу своего садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k1',
        name: 'Солнышко',
      })
      const res = await service.findOne(adminUser, 'g1')
      expect(res.id).toBe('g1')
    })
  })

  describe('create', () => {
    it('403 если у админа нет kindergartenId', async () => {
      await expect(
        service.create(globalOwner, { name: 'X' } as any),
      ).rejects.toThrow(ForbiddenException)
    })

    it('создаёт группу с привязкой к садику', async () => {
      prisma.group.create.mockResolvedValue({ id: 'g1' })
      await service.create(adminUser, {
        name: 'Радуга',
        ageRange: '4-5',
        capacity: 20,
        monthlyFee: 1200,
        fixedMonthlyExpense: 5000,
        color: '#6366f1',
      } as any)

      expect(prisma.group.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Радуга',
          kindergartenId: 'k1',
        }),
      })
    })
  })

  describe('update', () => {
    it('403 если группа из другого садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k2',
      })
      await expect(
        service.update(adminUser, 'g1', { name: 'X' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('обновляет группу своего садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k1',
      })
      prisma.group.update.mockResolvedValue({ id: 'g1', name: 'New' })

      await service.update(adminUser, 'g1', { name: 'New' })
      expect(prisma.group.update).toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('403 если группа из другого садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k2',
      })
      await expect(service.remove(adminUser, 'g1')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('удаляет группу своего садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k1',
      })
      prisma.group.delete.mockResolvedValue({})
      await service.remove(adminUser, 'g1')
      expect(prisma.group.delete).toHaveBeenCalled()
    })
  })
})
