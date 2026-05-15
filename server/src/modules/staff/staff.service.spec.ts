import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { StaffService } from './staff.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
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

const globalOwner: AuthUser = {
  ...adminK1,
  sub: 'owner',
  kindergartenId: null,
  role: 'SUPER_ADMIN',
}

describe('StaffService', () => {
  let service: StaffService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = ref.get(StaffService)
  })

  describe('findAll', () => {
    it('фильтрует по kindergartenId', async () => {
      prisma.staff.findMany.mockResolvedValue([])
      await service.findAll(adminK1, {})

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kindergartenId: 'k1' },
        }),
      )
    })

    it('глобальный супер-админ видит всех', async () => {
      prisma.staff.findMany.mockResolvedValue([])
      await service.findAll(globalOwner, {})

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })

    it('фильтр по должности', async () => {
      prisma.staff.findMany.mockResolvedValue([])
      await service.findAll(adminK1, { position: 'COOK' })

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kindergartenId: 'k1', position: 'COOK' },
        }),
      )
    })
  })

  describe('create', () => {
    const dto = {
      firstName: 'Иван',
      lastName: 'Петров',
      position: 'COOK' as const,
      phone: '+992901112233',
      salary: 3500,
      hireDate: '2026-01-01',
    }

    it('403 если у админа нет kindergartenId', async () => {
      await expect(service.create(globalOwner, dto)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('400 если нет имени или фамилии', async () => {
      await expect(
        service.create(adminK1, { ...dto, firstName: '' }),
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.create(adminK1, { ...dto, lastName: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если нет телефона', async () => {
      await expect(
        service.create(adminK1, { ...dto, phone: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('403 если группа из другого садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k2',
      })
      await expect(
        service.create(adminK1, { ...dto, groupId: 'g1' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('создаёт сотрудника с привязкой к садику', async () => {
      prisma.staff.create.mockResolvedValue({ id: 'new' })
      await service.create(adminK1, dto)

      expect(prisma.staff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'Иван',
          kindergartenId: 'k1',
        }),
      })
    })
  })

  describe('update / remove', () => {
    it('update 404 если не найден', async () => {
      prisma.staff.findUnique.mockResolvedValue(null)
      await expect(service.update(adminK1, 'x', {})).rejects.toThrow(
        NotFoundException,
      )
    })

    it('update 403 если из другого садика', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 's1',
        kindergartenId: 'k2',
      })
      await expect(service.update(adminK1, 's1', {})).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('remove успех своего садика', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 's1',
        kindergartenId: 'k1',
      })
      prisma.staff.delete.mockResolvedValue({})
      const res = await service.remove(adminK1, 's1')
      expect(res.success).toBe(true)
    })

    it('remove 403 чужого садика', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 's1',
        kindergartenId: 'k2',
      })
      await expect(service.remove(adminK1, 's1')).rejects.toThrow(
        ForbiddenException,
      )
    })
  })
})
