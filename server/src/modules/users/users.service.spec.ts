import { Test } from '@nestjs/testing'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { UsersService } from './users.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import { AccessService } from '../access/access.service'
import { createAccessMock, AccessMock, SECRET_HASH } from '../../test-utils/access-mock'

describe('UsersService', () => {
  let service: UsersService
  let prisma: PrismaMock
  let access: AccessMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    access = createAccessMock()
    const ref = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessService, useValue: access },
      ],
    }).compile()
    service = ref.get(UsersService)
  })

  describe('listTeachers', () => {
    it('фильтрует по kindergartenId админа', async () => {
      prisma.user.findMany.mockResolvedValue([])
      await service.listTeachers({ kindergartenId: 'k1' })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'TEACHER', kindergartenId: 'k1' },
        }),
      )
    })

    it('без фильтра для глобального супер-админа', async () => {
      prisma.user.findMany.mockResolvedValue([])
      await service.listTeachers({ kindergartenId: null })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'TEACHER' },
        }),
      )
    })
  })

  describe('createTeacher', () => {
    const validDto = {
      fullName: 'Учитель Тест',
      phone: '+992901112233',
      email: 'teacher@school.tj',
    }

    it('403 если у админа нет kindergartenId', async () => {
      await expect(
        service.createTeacher({ kindergartenId: null }, validDto),
      ).rejects.toThrow(ForbiddenException)
    })

    it('пароль админ не вводит: в базу уходит хеш случайного секрета', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.findFirst.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({ id: 't1', email: 'ivan@school.tj', fullName: 'Учитель Тест', role: 'TEACHER' })

      await service.createTeacher({ kindergartenId: 'k1' }, { ...validDto, email: 'ivan@school.tj' })

      expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBe(SECRET_HASH)
    })

    it('email в нижнем регистре, доступ уходит письмом, пароля в ответе нет', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.findFirst.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({ id: 't1', email: 'ivan@school.tj', fullName: 'Учитель Тест', role: 'TEACHER' })

      const res = await service.createTeacher({ kindergartenId: 'k1' }, { ...validDto, email: 'Ivan@School.TJ' })

      expect(prisma.user.create.mock.calls[0][0].data.email).toBe('ivan@school.tj')
      expect(access.deliver).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
      expect(res.access).toEqual({ sent: true, email: 'ivan@school.tj' })
      expect(JSON.stringify(res)).not.toMatch(/password/i)
    })

    it('без настоящей почты учителя не создаём: служебные адреса не выдумываются', async () => {
      for (const email of [undefined, '', 'не-почта', 'teacher-1@kindergarten.local']) {
        await expect(service.createTeacher({ kindergartenId: 'k1' }, { ...validDto, email: email as never })).rejects.toThrow(/Укажите email/)
      }
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(access.deliver).not.toHaveBeenCalled()
    })

    it('письмо не ушло: учитель создан, пароль не выдаётся, причина видна', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.findFirst.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({ id: 't1', email: 'teacher@school.tj', fullName: 'Учитель Тест', role: 'TEACHER' })
      access.deliver.mockResolvedValue({ sent: false, email: 'teacher@school.tj', reason: 'NOT_CONFIGURED' })

      const res = await service.createTeacher({ kindergartenId: 'k1' }, validDto)

      expect(res.access).toMatchObject({ sent: false, reason: 'NOT_CONFIGURED' })
      expect(JSON.stringify(res)).not.toMatch(/password/i)
    })

    it('ошибки проверок (нет ФИО, занятый email) возникают до создания секрета и аккаунта', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
      await expect(service.createTeacher({ kindergartenId: 'k1' }, { ...validDto, email: 'taken@kg.tj' })).rejects.toThrow(ConflictException)
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(access.deliver).not.toHaveBeenCalled()
    })

    it('старый клиент прислал пароль → понятный отказ, аккаунт не создаётся', async () => {
      await expect(
        service.createTeacher({ kindergartenId: 'k1' }, { ...validDto, email: 'a@b.tj', password: 'hack-123456' } as never),
      ).rejects.toThrow(/Пароль не задаётся/)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('при правке учителя пароль тоже не принимается', async () => {
      await expect(service.updateTeacher({ kindergartenId: 'k1' }, 'u2', { password: 'hack-123456' } as never)).rejects.toThrow(/Пароль не задаётся/)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('400 если нет ФИО', async () => {
      await expect(
        service.createTeacher(
          { kindergartenId: 'k1' },
          { ...validDto, fullName: '' },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('400 если нет телефона', async () => {
      await expect(
        service.createTeacher(
          { kindergartenId: 'k1' },
          { ...validDto, phone: '' },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('409 если email уже занят', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
      await expect(
        service.createTeacher(
          { kindergartenId: 'k1' },
          { ...validDto, email: 'taken@kg.tj' },
        ),
      ).rejects.toThrow(ConflictException)
    })

    it('409 если телефон уже занят в этом садике', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'existing' })
      await expect(
        service.createTeacher({ kindergartenId: 'k1' }, validDto),
      ).rejects.toThrow(ConflictException)
    })

    it('409 если у группы уже есть учитель', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.findFirst
        .mockResolvedValueOnce(null) // phone check
        .mockResolvedValueOnce({ id: 'existing-teacher' }) // group check
      await expect(
        service.createTeacher(
          { kindergartenId: 'k1' },
          { ...validDto, groupId: 'g1' },
        ),
      ).rejects.toThrow(ConflictException)
    })

    it('успешно создаёт учителя с kindergartenId', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.findFirst.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({
        id: 'new-teacher',
        email: 'teacher@school.tj',
        fullName: 'Учитель Тест',
        role: 'TEACHER',
        phone: '+992901112233',
        groupId: null,
        isActive: true,
        createdAt: new Date(),
      })

      const result = await service.createTeacher(
        { kindergartenId: 'k1' },
        validDto,
      )

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kindergartenId: 'k1',
            role: 'TEACHER',
          }),
        }),
      )
      expect(result.role).toBe('TEACHER')
    })
  })

  describe('updateTeacher', () => {
    it('404 если учитель не найден', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.updateTeacher({ kindergartenId: 'k1' }, 'missing', {}),
      ).rejects.toThrow(NotFoundException)
    })

    it('403 если учитель из другого садика', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: 'TEACHER',
        kindergartenId: 'k2',
      })
      await expect(
        service.updateTeacher({ kindergartenId: 'k1' }, 'u2', {}),
      ).rejects.toThrow(ForbiddenException)
    })

    it('обновляет учителя из своего садика', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: 'TEACHER',
        kindergartenId: 'k1',
      })
      prisma.user.update.mockResolvedValue({ id: 'u2', fullName: 'New' })

      await service.updateTeacher(
        { kindergartenId: 'k1' },
        'u2',
        { fullName: 'New' },
      )

      expect(prisma.user.update).toHaveBeenCalled()
    })
  })

  describe('deleteTeacher', () => {
    it('403 если учитель из другого садика', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: 'TEACHER',
        kindergartenId: 'k2',
      })
      await expect(
        service.deleteTeacher({ kindergartenId: 'k1' }, 'u2'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('успешно удаляет учителя своего садика', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: 'TEACHER',
        kindergartenId: 'k1',
      })
      prisma.user.delete.mockResolvedValue({ id: 'u2' })

      const res = await service.deleteTeacher({ kindergartenId: 'k1' }, 'u2')
      expect(res.success).toBe(true)
    })
  })
})
