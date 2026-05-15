import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { ExpensesService } from './expenses.service'
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

describe('ExpensesService', () => {
  let service: ExpensesService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = ref.get(ExpensesService)
  })

  describe('findAll', () => {
    it('фильтрует по садику + месяцу', async () => {
      prisma.expense.findMany.mockResolvedValue([])
      await service.findAll(adminK1, { month: '2026-05' })

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kindergartenId: 'k1', month: '2026-05' },
        }),
      )
    })

    it('фильтр по категории', async () => {
      prisma.expense.findMany.mockResolvedValue([])
      await service.findAll(adminK1, { category: 'SALARIES' })

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'SALARIES' }),
        }),
      )
    })
  })

  describe('create', () => {
    const dto = {
      category: 'FOOD' as const,
      description: 'Молоко',
      amount: 500,
      month: '2026-05',
    }

    it('403 если нет kindergartenId', async () => {
      await expect(
        service.create({ ...adminK1, kindergartenId: null }, dto),
      ).rejects.toThrow(ForbiddenException)
    })

    it('400 если нет описания', async () => {
      await expect(
        service.create(adminK1, { ...dto, description: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если нет месяца', async () => {
      await expect(
        service.create(adminK1, { ...dto, month: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если сумма отрицательная', async () => {
      await expect(
        service.create(adminK1, { ...dto, amount: -10 }),
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

    it('создаёт расход (общий) с kindergartenId', async () => {
      prisma.expense.create.mockResolvedValue({ id: 'e1' })
      await service.create(adminK1, dto)

      expect(prisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: 'FOOD',
          kindergartenId: 'k1',
          groupId: null,
        }),
        include: expect.anything(),
      })
    })

    it('создаёт расход с привязкой к группе', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k1',
      })
      prisma.expense.create.mockResolvedValue({ id: 'e1' })

      await service.create(adminK1, { ...dto, groupId: 'g1' })

      expect(prisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ groupId: 'g1' }),
        include: expect.anything(),
      })
    })
  })

  describe('update / remove', () => {
    it('update 404 если не найден', async () => {
      prisma.expense.findUnique.mockResolvedValue(null)
      await expect(service.update(adminK1, 'x', {})).rejects.toThrow(
        NotFoundException,
      )
    })

    it('update 403 если из другого садика', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        kindergartenId: 'k2',
      })
      await expect(service.update(adminK1, 'e1', {})).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('remove успех своего садика', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        kindergartenId: 'k1',
      })
      prisma.expense.delete.mockResolvedValue({})
      const res = await service.remove(adminK1, 'e1')
      expect(res.success).toBe(true)
    })

    it('remove 403 чужого садика', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        kindergartenId: 'k2',
      })
      await expect(service.remove(adminK1, 'e1')).rejects.toThrow(
        ForbiddenException,
      )
    })
  })
})
