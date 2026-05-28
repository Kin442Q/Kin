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
    // teacherGroupIds() по умолчанию: учитель ведёт только g1
    prisma.user.findUnique.mockResolvedValue({ groupId: 'g1', teachingGroups: [] })
  })

  describe('findAll', () => {
    it('TEACHER без классов — пустой массив', async () => {
      prisma.user.findUnique.mockResolvedValue({ groupId: null, teachingGroups: [] })
      const res = await service.findAll(
        { ...teacherK1, groupId: null },
        {},
      )
      expect(res).toEqual([])
    })

    it('TEACHER видит свои классы', async () => {
      prisma.student.findMany.mockResolvedValue([])
      await service.findAll(teacherK1, {})

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            groupId: { in: ['g1'] },
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

  describe('bulkCreate', () => {
    beforeEach(() => {
      // группы учреждения для валидации/резолва по имени
      prisma.group.findMany.mockResolvedValue([{ id: 'g1', name: '1А' }])
      // create() проверяет группу по id
      prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'k1' })
      prisma.student.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'new', ...args.data }),
      )
    })

    it('403 если нет kindergartenId', async () => {
      await expect(
        service.bulkCreate({ ...adminK1, kindergartenId: null }, [
          { firstName: 'A', lastName: 'B', birthDate: '2020-01-01', groupId: 'g1' },
        ]),
      ).rejects.toThrow(ForbiddenException)
    })

    it('400 если список пуст', async () => {
      await expect(service.bulkCreate(adminK1, [])).rejects.toThrow(
        'Список пуст',
      )
    })

    it('создаёт валидные строки, ошибочные — в errors[]', async () => {
      const r = await service.bulkCreate(adminK1, [
        { firstName: 'Айша', lastName: 'К', birthDate: '2020-05-01', groupId: 'g1' },
        { firstName: '', lastName: 'Нет имени', birthDate: '2020-01-01', groupId: 'g1' },
        { firstName: 'Иван', lastName: 'П', birthDate: 'кривая', groupId: 'g1' },
      ])
      expect(r.createdCount).toBe(1)
      expect(r.errorCount).toBe(2)
      expect(r.errors[0].message).toMatch(/имя|фамилия/i)
      expect(r.errors[1].message).toMatch(/дат/i)
    })

    it('резолвит группу по имени (groupName)', async () => {
      const r = await service.bulkCreate(adminK1, [
        { firstName: 'Лола', lastName: 'С', birthDate: '2021-03-03', groupName: '1а' },
      ])
      expect(r.createdCount).toBe(1)
      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ groupId: 'g1' }),
        }),
      )
    })

    it('неизвестная группа → строка в errors', async () => {
      const r = await service.bulkCreate(adminK1, [
        { firstName: 'X', lastName: 'Y', birthDate: '2020-01-01', groupName: 'нет такой' },
      ])
      expect(r.createdCount).toBe(0)
      expect(r.errors[0].message).toMatch(/руппа|класс/i)
    })
  })
})
