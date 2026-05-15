import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { KindergartensService } from './kindergartens.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const globalOwner: AuthUser = {
  sub: 'owner',
  email: 'owner@kg.tj',
  role: 'SUPER_ADMIN',
  kindergartenId: null,
  groupId: null,
  childId: null,
}

const tenantAdmin: AuthUser = {
  sub: 'admin',
  email: 'admin@kg.tj',
  role: 'SUPER_ADMIN',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}

describe('KindergartensService', () => {
  let service: KindergartensService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [
        KindergartensService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = ref.get(KindergartensService)
  })

  describe('assertGlobalOwner (через list)', () => {
    it('403 если у пользователя есть kindergartenId', async () => {
      await expect(service.list(tenantAdmin)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('403 если не SUPER_ADMIN', async () => {
      await expect(
        service.list({ ...globalOwner, role: 'ADMIN' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('успех для глобального супер-админа', async () => {
      prisma.kindergarten.findMany.mockResolvedValue([])
      await service.list(globalOwner)
      expect(prisma.kindergarten.findMany).toHaveBeenCalled()
    })
  })

  describe('create', () => {
    const validDto = {
      name: 'Радуга',
      owner: {
        fullName: 'Иван Иванов',
        email: 'ivan@kg.tj',
        password: 'secret123',
      },
    }

    it('403 для не-глобального пользователя', async () => {
      await expect(
        service.create(tenantAdmin, validDto),
      ).rejects.toThrow(ForbiddenException)
    })

    it('400 если нет названия', async () => {
      await expect(
        service.create(globalOwner, { ...validDto, name: '' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если email владельца не указан', async () => {
      await expect(
        service.create(globalOwner, {
          ...validDto,
          owner: { ...validDto.owner, email: '' },
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если пароль короче 6 символов', async () => {
      await expect(
        service.create(globalOwner, {
          ...validDto,
          owner: { ...validDto.owner, password: '123' },
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если ФИО владельца не указано', async () => {
      await expect(
        service.create(globalOwner, {
          ...validDto,
          owner: { ...validDto.owner, fullName: '' },
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('409 если email уже занят', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
      await expect(service.create(globalOwner, validDto)).rejects.toThrow(
        ConflictException,
      )
    })

    it('успешно создаёт садик + первого владельца', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      // Для проверки уникальности slug
      prisma.kindergarten.findUnique
        .mockResolvedValueOnce(null) // base slug — свободен
      prisma.kindergarten.create.mockResolvedValue({
        id: 'newK',
        name: 'Радуга',
        slug: 'raduga',
      })
      prisma.user.create.mockResolvedValue({
        id: 'newOwner',
        email: 'ivan@kg.tj',
      })

      const res = await service.create(globalOwner, validDto)

      expect(res.kindergarten.name).toBe('Радуга')
      expect(res.owner.email).toBe('ivan@kg.tj')
    })

    it('генерирует уникальный slug при коллизии', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.kindergarten.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // base slug занят
        .mockResolvedValueOnce(null) // base-1 — свободен
      prisma.kindergarten.create.mockResolvedValue({
        id: 'newK',
        slug: 'raduga-1',
      })
      prisma.user.create.mockResolvedValue({ id: 'newOwner' })

      await service.create(globalOwner, validDto)

      expect(prisma.kindergarten.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'raduga-1' }),
      })
    })
  })

  describe('update / remove', () => {
    it('update 403 для не-глобального', async () => {
      await expect(
        service.update(tenantAdmin, 'k1', { name: 'X' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('update 404 если садик не найден', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue(null)
      await expect(
        service.update(globalOwner, 'kX', { name: 'X' }),
      ).rejects.toThrow(NotFoundException)
    })

    it('remove 403 для не-глобального', async () => {
      await expect(service.remove(tenantAdmin, 'k1')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('remove успех для глобального', async () => {
      prisma.kindergarten.findUnique.mockResolvedValue({ id: 'k1' })
      prisma.kindergarten.delete.mockResolvedValue({})
      const res = await service.remove(globalOwner, 'k1')
      expect(res.success).toBe(true)
    })
  })
})
