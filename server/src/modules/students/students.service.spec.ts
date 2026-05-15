import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'

import { StudentsService } from './students.service'
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

const teacherK1: AuthUser = {
  sub: 't',
  email: 't@kg.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: 'g1',
  childId: null,
}

const adminK2: AuthUser = {
  ...adminK1,
  kindergartenId: 'k2',
}

const baseStudentDto = {
  firstName: 'Айша',
  lastName: 'Каримова',
  birthDate: '2022-05-10',
  gender: 'FEMALE' as const,
  groupId: 'g1',
}

describe('StudentsService', () => {
  let service: StudentsService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = ref.get(StudentsService)
  })

  describe('findAll', () => {
    it('TEACHER без groupId — пустой массив', async () => {
      const res = await service.findAll(
        { ...teacherK1, groupId: null },
        {},
      )
      expect(res).toEqual([])
    })

    it('TEACHER видит только свою группу', async () => {
      prisma.student.findMany.mockResolvedValue([])
      await service.findAll(teacherK1, {})

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            groupId: 'g1',
            kindergartenId: 'k1',
          }),
        }),
      )
    })

    it('ADMIN видит только свой садик', async () => {
      prisma.student.findMany.mockResolvedValue([])
      await service.findAll(adminK1, {})

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ kindergartenId: 'k1' }),
        }),
      )
    })

    it('ADMIN может фильтровать по группе своего садика', async () => {
      prisma.student.findMany.mockResolvedValue([])
      await service.findAll(adminK1, { groupId: 'g2' })

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: 'g2' }),
        }),
      )
    })
  })

  describe('create', () => {
    it('403 если нет kindergartenId', async () => {
      await expect(
        service.create(baseStudentDto as any, {
          ...adminK1,
          kindergartenId: null,
        }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('403 если группа из другого садика', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k2',
      })
      await expect(
        service.create(baseStudentDto as any, adminK1),
      ).rejects.toThrow(ForbiddenException)
    })

    it('404 если группа не найдена', async () => {
      prisma.group.findUnique.mockResolvedValue(null)
      await expect(
        service.create(baseStudentDto as any, adminK1),
      ).rejects.toThrow(NotFoundException)
    })

    it('TEACHER принудительно использует свою groupId', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k1',
      })
      prisma.student.create.mockResolvedValue({})

      await service.create(
        { ...baseStudentDto, groupId: 'g999' } as any,
        teacherK1,
      )

      expect(prisma.student.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ groupId: 'g1' }),
      })
    })

    it('создаёт студента с привязкой к садику', async () => {
      prisma.group.findUnique.mockResolvedValue({
        id: 'g1',
        kindergartenId: 'k1',
      })
      prisma.student.create.mockResolvedValue({ id: 'new-student' })

      await service.create(baseStudentDto as any, adminK1)

      expect(prisma.student.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kindergartenId: 'k1' }),
      })
    })
  })

  describe('findOne / assertCanAccess', () => {
    it('403 если студент из другого садика', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k2',
      })
      await expect(service.findOne('s1', adminK1)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('403 TEACHER не видит ученика из чужой группы', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g999',
        kindergartenId: 'k1',
      })
      await expect(service.findOne('s1', teacherK1)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('возвращает студента из своего садика и группы', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
        firstName: 'Айша',
      })
      const res = await service.findOne('s1', teacherK1)
      expect(res.id).toBe('s1')
    })
  })

  describe('update', () => {
    it('TEACHER не может сменить группу', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
      })
      await expect(
        service.update('s1', { groupId: 'g2' } as any, teacherK1),
      ).rejects.toThrow(ForbiddenException)
    })

    it('обновляет ученика своего садика', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
      })
      prisma.student.update.mockResolvedValue({})

      await service.update('s1', { firstName: 'New' } as any, adminK1)
      expect(prisma.student.update).toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('403 если ученик из другого садика', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k2',
      })
      await expect(service.remove('s1', adminK1)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('удаляет ученика своего садика', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
      })
      prisma.student.delete.mockResolvedValue({})
      await service.remove('s1', adminK1)
      expect(prisma.student.delete).toHaveBeenCalled()
    })
  })
})
