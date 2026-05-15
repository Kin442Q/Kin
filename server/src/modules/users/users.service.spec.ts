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

describe('UsersService', () => {
  let service: UsersService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
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
      password: 'secret123',
    }

    it('403 если у админа нет kindergartenId', async () => {
      await expect(
        service.createTeacher({ kindergartenId: null }, validDto),
      ).rejects.toThrow(ForbiddenException)
    })

    it('400 если пароль короче 6 символов', async () => {
      await expect(
        service.createTeacher(
          { kindergartenId: 'k1' },
          { ...validDto, password: '123' },
        ),
      ).rejects.toThrow(BadRequestException)
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
        email: 'teacher-992901112233@kindergarten.local',
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

    it('генерирует email из телефона если не указан', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.findFirst.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({})

      await service.createTeacher({ kindergartenId: 'k1' }, validDto)

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'teacher-992901112233@kindergarten.local',
          }),
        }),
      )
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
