import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { StaffService } from './staff.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import { AccessService } from '../access/access.service'
import { createAccessMock, AccessMock, SECRET_HASH } from '../../test-utils/access-mock'
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
  let access: AccessMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    access = createAccessMock()
    const ref = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessService, useValue: access },
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

      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'Иван',
            kindergartenId: 'k1',
          }),
        }),
      )
    })
  })

  describe('create — вход в систему без пароля от админа', () => {
    const dto = {
      firstName: 'Иван',
      lastName: 'Петров',
      position: 'COOK' as const,
      phone: '+992901112233',
      salary: 3500,
      hireDate: '2026-01-01',
      canLogin: true,
    }

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'u1', fullName: data.fullName, email: data.email }))
      prisma.staff.create.mockResolvedValue({ id: 's1', firstName: 'Иван', lastName: 'Петров', position: 'COOK' })
    })

    it('учётка создаётся со случайным хешем, email в нижнем регистре, доступ уходит письмом', async () => {
      const res = await service.create(adminK1, { ...dto, email: 'Ivan@School.TJ' })

      const data = prisma.user.create.mock.calls[0][0].data
      expect(data).toMatchObject({ email: 'ivan@school.tj', passwordHash: SECRET_HASH, role: 'TEACHER', kindergartenId: 'k1' })
      expect(access.deliver).toHaveBeenCalledWith({ id: 'u1', fullName: 'Петров Иван', email: 'ivan@school.tj' })
      expect(res.access).toEqual({ sent: true, email: 'ivan@school.tj' })
      expect(prisma.staff.create.mock.calls[0][0].data.userId).toBe('u1')
    })

    it('без настоящей почты учётка не создаётся: пароль не выдаётся, служебных адресов нет', async () => {
      await expect(service.create(adminK1, { ...dto, email: undefined })).rejects.toThrow(/Укажите email/)
      await expect(service.create(adminK1, { ...dto, email: 'не-почта' })).rejects.toThrow(/Укажите email/)

      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(prisma.staff.create).not.toHaveBeenCalled()
      expect(access.deliver).not.toHaveBeenCalled()
    })

    it('email занят → 409, ни сотрудник, ни доступ не создаются', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'someone' })

      await expect(service.create(adminK1, { ...dto, email: 'taken@school.tj' })).rejects.toThrow(ConflictException)
      expect(prisma.staff.create).not.toHaveBeenCalled()
      expect(access.deliver).not.toHaveBeenCalled()
    })

    it('без «может входить в систему»: аккаунта и доступа нет, access: null', async () => {
      const res = await service.create(adminK1, { ...dto, canLogin: false })

      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(access.newSecret).not.toHaveBeenCalled()
      expect(res.access).toBeNull()
    })
  })

  describe('update — включение входа в систему', () => {
    const existing = {
      id: 's1',
      kindergartenId: 'k1',
      firstName: 'Иван',
      lastName: 'Петров',
      phone: '+992901112233',
      email: 'ivan@school.tj',
      userId: null,
      groupId: null,
    }

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'u1', fullName: data.fullName, email: data.email }))
      prisma.staff.update.mockResolvedValue({ id: 's1' })
    })

    it('учётка появляется без пароля от админа, письмо уходит на почту сотрудника', async () => {
      prisma.staff.findUnique.mockResolvedValue(existing)

      const res = await service.update(adminK1, 's1', { canLogin: true })

      expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ email: 'ivan@school.tj', passwordHash: SECRET_HASH })
      expect(res.access).toEqual({ sent: true, email: 'ivan@school.tj' })
    })

    it('обычное редактирование доступа не выдаёт: access: null', async () => {
      prisma.staff.findUnique.mockResolvedValue({ ...existing, userId: 'u9' })
      prisma.user.update.mockResolvedValue({})

      const res = await service.update(adminK1, 's1', { phone: '+992900000000' })

      expect(access.deliver).not.toHaveBeenCalled()
      expect(res.access).toBeNull()
    })

    it('пароль в запросе на правку игнорируется — менять пароль админ не может', async () => {
      prisma.staff.findUnique.mockResolvedValue({ ...existing, userId: 'u9' })
      prisma.user.update.mockResolvedValue({})

      await service.update(adminK1, 's1', { phone: '+992900000000', password: 'hack-12345' } as never)

      const data = prisma.user.update.mock.calls[0][0].data
      expect(data).not.toHaveProperty('passwordHash')
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
