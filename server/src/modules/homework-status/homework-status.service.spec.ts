import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { HomeworkStatusService } from './homework-status.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { ClassAccessService } from '../class-access/class-access.service'
import type { ParentNoticeService } from '../parent-notice/parent-notice.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const teacher: AuthUser = {
  sub: 't1',
  email: 't@s.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: 'g1',
  childId: null,
}

const hw = {
  id: 'hw1',
  title: 'Задачи 5–7',
  description: null,
  dueDate: new Date('2026-11-05'),
  groupId: 'g1',
  subject: { id: 's1', name: 'Математика', color: '#4FB286' },
  group: { id: 'g1', name: '5А', kindergartenId: 'k1' },
}

describe('HomeworkStatusService', () => {
  let prisma: PrismaMock
  let access: { assertStaffAccess: jest.Mock }
  let notice: { parentIdsByStudent: jest.Mock; notify: jest.Mock }
  let service: HomeworkStatusService

  beforeEach(() => {
    prisma = createPrismaMock()
    access = { assertStaffAccess: jest.fn().mockResolvedValue(undefined) }
    notice = {
      parentIdsByStudent: jest.fn().mockResolvedValue(new Map()),
      notify: jest.fn().mockResolvedValue({ sent: 1 }),
    }
    service = new HomeworkStatusService(
      prisma as unknown as PrismaService,
      access as unknown as ClassAccessService,
      notice as unknown as ParentNoticeService,
    )
    prisma.homework.findUnique.mockResolvedValue(hw)
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  describe('доступ', () => {
    it('ДЗ не найдено → 404', async () => {
      prisma.homework.findUnique.mockResolvedValue(null)
      await expect(service.roster(teacher, 'nope')).rejects.toThrow(NotFoundException)
    })

    it('учитель чужого класса не видит статусы', async () => {
      access.assertStaffAccess.mockRejectedValue(new ForbiddenException('Это не ваш класс'))
      await expect(service.roster(teacher, 'hw1')).rejects.toThrow(ForbiddenException)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
      expect(access.assertStaffAccess).toHaveBeenCalledWith(teacher, hw.group)
    })
  })

  describe('roster', () => {
    it('ученики класса со статусами, сводка и число родителей', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 'a', firstName: 'Али', lastName: 'А', photoUrl: null, gender: 'MALE' },
        { id: 'b', firstName: 'Баха', lastName: 'Б', photoUrl: null, gender: 'MALE' },
        { id: 'c', firstName: 'Вера', lastName: 'В', photoUrl: null, gender: 'FEMALE' },
        { id: 'd', firstName: 'Гуля', lastName: 'Г', photoUrl: null, gender: 'FEMALE' },
      ])
      prisma.homeworkSubmission.findMany.mockResolvedValue([
        { studentId: 'a', status: 'DONE', comment: 'молодец', updatedAt: new Date('2026-11-04') },
        { studentId: 'b', status: 'NOT_DONE', comment: null, updatedAt: new Date('2026-11-04') },
        { studentId: 'c', status: 'SUBMITTED', comment: null, updatedAt: new Date('2026-11-04') },
      ])
      notice.parentIdsByStudent.mockResolvedValue(new Map([['a', ['p1', 'p2']], ['b', []]]))

      const r = await service.roster(teacher, 'hw1')

      expect(r.homework).toMatchObject({ id: 'hw1', subject: { name: 'Математика' }, group: { name: '5А' } })
      expect(r.summary).toEqual({ total: 4, done: 1, partial: 0, notDone: 1, submitted: 1, unmarked: 1 })
      expect(r.students.find((x) => x.student.id === 'a')).toMatchObject({ status: 'DONE', comment: 'молодец', parentsCount: 2 })
      expect(r.students.find((x) => x.student.id === 'd')).toMatchObject({ status: null, parentsCount: 0 })
      // только действующие ученики этого класса
      expect(prisma.student.findMany.mock.calls[0][0].where).toEqual({ groupId: 'g1', status: 'ACTIVE' })
    })
  })

  describe('setStatuses', () => {
    beforeEach(() => {
      prisma.student.count.mockResolvedValue(2)
      prisma.student.findMany.mockResolvedValue([])
      prisma.homeworkSubmission.findMany.mockResolvedValue([])
      prisma.homeworkSubmission.upsert.mockReturnValue('upsert')
      prisma.homeworkSubmission.deleteMany.mockReturnValue('delete')
    })

    it('upsert для статусов, deleteMany для null; комментарий не передан — не трогаем', async () => {
      await service.setStatuses(teacher, 'hw1', [
        { studentId: 'a', status: 'DONE' },
        { studentId: 'b', status: null },
      ])

      const call = prisma.homeworkSubmission.upsert.mock.calls[0][0]
      expect(call.where).toEqual({ homeworkId_studentId: { homeworkId: 'hw1', studentId: 'a' } })
      expect(call.create).toEqual({
        homeworkId: 'hw1',
        studentId: 'a',
        status: 'DONE',
        comment: null,
        markedById: 't1',
      })
      expect(call.update).toEqual({ status: 'DONE', comment: undefined, markedById: 't1' })
      expect(prisma.homeworkSubmission.deleteMany).toHaveBeenCalledWith({
        where: { homeworkId: 'hw1', studentId: 'b' },
      })
    })

    it('повтор по одному ученику: побеждает последняя запись', async () => {
      prisma.student.count.mockResolvedValue(1)
      await service.setStatuses(teacher, 'hw1', [
        { studentId: 'a', status: 'NOT_DONE' },
        { studentId: 'a', status: 'PARTIAL', comment: 'вторая часть' },
      ])
      expect(prisma.homeworkSubmission.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.homeworkSubmission.upsert.mock.calls[0][0].update).toMatchObject({
        status: 'PARTIAL',
        comment: 'вторая часть',
      })
    })

    it('ученик не из этого класса → 400, ничего не записано', async () => {
      prisma.student.count.mockResolvedValue(1) // из двух найден один
      await expect(
        service.setStatuses(teacher, 'hw1', [
          { studentId: 'a', status: 'DONE' },
          { studentId: 'foreign', status: 'DONE' },
        ]),
      ).rejects.toThrow(BadRequestException)
      expect(prisma.homeworkSubmission.upsert).not.toHaveBeenCalled()
      expect(prisma.student.count.mock.calls[0][0].where).toEqual({
        id: { in: ['a', 'foreign'] },
        groupId: 'g1',
      })
    })
  })

  describe('notifyParents', () => {
    beforeEach(() => {
      prisma.student.findMany.mockResolvedValue([
        { id: 'a', firstName: 'Али', gender: 'MALE' },
        { id: 'b', firstName: 'Мадина', gender: 'FEMALE' },
        { id: 'c', firstName: 'Вера', gender: 'FEMALE' },
      ])
      prisma.homeworkSubmission.findMany.mockResolvedValue([
        { studentId: 'a', status: 'NOT_DONE' },
        { studentId: 'b', status: 'PARTIAL' },
      ])
    })

    it('шаблон выбирается по статусу каждого ученика', async () => {
      const r = await service.notifyParents(teacher, 'hw1', { studentIds: ['a', 'b', 'c'] })

      const texts = notice.notify.mock.calls.map((c) => c[2] as string)
      expect(texts[0]).toContain('Али не выполнил домашнее задание')
      expect(texts[1]).toContain('Мадина выполнила домашнее задание')
      expect(texts[1]).toContain('не полностью')
      expect(texts[2]).toContain('Напоминаем') // у Веры нет статуса
      expect(r).toEqual({ notified: 3, sent: 3, skipped: [] })
    })

    it('явный шаблон и комментарий применяются ко всем', async () => {
      await service.notifyParents(teacher, 'hw1', {
        studentIds: ['a', 'b', 'c'],
        template: 'REMINDER',
        note: 'Сдать до пятницы',
      })
      for (const c of notice.notify.mock.calls) {
        expect(c[2]).toContain('Напоминаем')
        expect(c[2]).toContain('Комментарий учителя: Сдать до пятницы')
      }
    })

    it('ученики без родителей попадают в skipped', async () => {
      notice.notify.mockImplementation(async (_u: AuthUser, id: string) => ({ sent: id === 'b' ? 0 : 2 }))
      const r = await service.notifyParents(teacher, 'hw1', { studentIds: ['a', 'b', 'c'] })
      expect(r).toEqual({ notified: 2, sent: 4, skipped: [{ studentId: 'b', reason: 'NO_PARENTS' }] })
    })

    it('ученик не из класса → 400, никому не отправлено', async () => {
      await expect(
        service.notifyParents(teacher, 'hw1', { studentIds: ['a', 'b', 'c', 'foreign'] }),
      ).rejects.toThrow(BadRequestException)
      expect(notice.notify).not.toHaveBeenCalled()
    })
  })
})
