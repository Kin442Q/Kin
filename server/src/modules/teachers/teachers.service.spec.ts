import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'

import { TeachersService } from './teachers.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const adminA: AuthUser = {
  sub: 'adminA',
  email: 'a@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'kA',
  groupId: null,
  childId: null,
}

const globalOwner: AuthUser = {
  sub: 'owner',
  email: 'owner@kg.tj',
  role: 'SUPER_ADMIN',
  kindergartenId: null,
  groupId: null,
  childId: null,
}

describe('TeachersService — изоляция школ', () => {
  let service: TeachersService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [TeachersService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = ref.get(TeachersService)
  })

  describe('list', () => {
    it('админ школы видит только учителей своей школы', async () => {
      prisma.user.findMany.mockResolvedValue([])
      await service.list(adminA)
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
        role: 'TEACHER',
        kindergartenId: 'kA',
      })
    })

    it('владелец платформы видит учителей всех школ', async () => {
      prisma.user.findMany.mockResolvedValue([])
      await service.list(globalOwner)
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'TEACHER' })
    })
  })

  describe('assignGroup', () => {
    it('404 для учителя из чужой школы, без изменений в БД', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kB' })
      await expect(service.assignGroup(adminA, 't1', 'gA')).rejects.toThrow(NotFoundException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('404 если id принадлежит не учителю', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'p1', role: 'PARENT', kindergartenId: 'kA' })
      await expect(service.assignGroup(adminA, 'p1', null)).rejects.toThrow(NotFoundException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('404 если класс из другой школы', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kA' })
      prisma.group.findMany.mockResolvedValue([]) // в школе kA такого класса нет
      await expect(service.assignGroup(adminA, 't1', 'gB')).rejects.toThrow(NotFoundException)
      expect(prisma.group.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ['gB'] },
        kindergartenId: 'kA',
      })
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('назначает класс своей школы', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kA' })
      prisma.group.findMany.mockResolvedValue([{ id: 'gA' }])
      prisma.user.update.mockResolvedValue({ id: 't1', groupId: 'gA' })
      await service.assignGroup(adminA, 't1', 'gA')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { groupId: 'gA' },
      })
    })

    it('снятие класса (null) не требует проверки групп', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kA' })
      prisma.user.update.mockResolvedValue({ id: 't1', groupId: null })
      await service.assignGroup(adminA, 't1', null)
      expect(prisma.group.findMany).not.toHaveBeenCalled()
      expect(prisma.user.update).toHaveBeenCalled()
    })
  })

  describe('setClasses', () => {
    it('404 для учителя из чужой школы', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kB' })
      await expect(service.setClasses(adminA, 't1', ['gA'])).rejects.toThrow(NotFoundException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('404 если хотя бы один класс чужой', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kA' })
      prisma.group.findMany.mockResolvedValue([{ id: 'gA' }]) // gB не найден в kA
      await expect(service.setClasses(adminA, 't1', ['gA', 'gB'])).rejects.toThrow(
        NotFoundException,
      )
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('первый класс становится основным, дубликаты убираются', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kA' })
      prisma.group.findMany.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }])
      prisma.user.update.mockResolvedValue({})
      await service.setClasses(adminA, 't1', ['g1', 'g2', 'g1'])
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        teachingGroups: { set: [{ id: 'g1' }, { id: 'g2' }] },
        groupId: 'g1',
      })
    })

    it('владелец платформы проверяет классы по школе самого учителя', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER', kindergartenId: 'kB' })
      prisma.group.findMany.mockResolvedValue([{ id: 'gB' }])
      prisma.user.update.mockResolvedValue({})
      await service.setClasses(globalOwner, 't1', ['gB'])
      expect(prisma.group.findMany.mock.calls[0][0].where.kindergartenId).toBe('kB')
    })
  })
})
