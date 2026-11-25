import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { ForbiddenException, NotFoundException } from '@nestjs/common'

import { AttendanceService } from './attendance.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { QUEUE_ATTENDANCE_NOTICE } from '../../infrastructure/bullmq/bull.module'
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

describe('AttendanceService', () => {
  let service: AttendanceService
  let prisma: PrismaMock
  let noticeQ: { add: jest.Mock; getJob: jest.Mock }

  beforeEach(async () => {
    prisma = createPrismaMock()
    noticeQ = { add: jest.fn().mockResolvedValue({}), getJob: jest.fn().mockResolvedValue(null) }
    const ref = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { delByPattern: jest.fn() } },
        { provide: getQueueToken(QUEUE_ATTENDANCE_NOTICE), useValue: noticeQ },
      ],
    }).compile()
    service = ref.get(AttendanceService)
    // teacherGroupIds() по умолчанию: учитель ведёт только g1
    prisma.user.findUnique.mockResolvedValue({ groupId: 'g1', teachingGroups: [] })
  })

  describe('listByDay', () => {
    it('TEACHER без классов — пустой массив', async () => {
      prisma.user.findUnique.mockResolvedValue({ groupId: null, teachingGroups: [] })
      const res = await service.listByDay(
        { ...teacherK1, groupId: null },
        { date: '2026-05-14' },
      )
      expect(res).toEqual([])
    })

    it('TEACHER: чужой класс игнорируется, фильтр по своим классам', async () => {
      prisma.attendance.findMany.mockResolvedValue([])
      await service.listByDay(teacherK1, {
        date: '2026-05-14',
        groupId: 'g999', // не его класс → игнорируется
      })

      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: { in: ['g1'] } }),
        }),
      )
    })

    it('TEACHER с несколькими классами фильтрует по всем', async () => {
      prisma.user.findUnique.mockResolvedValue({
        groupId: 'g1',
        teachingGroups: [{ id: 'g2' }],
      })
      prisma.attendance.findMany.mockResolvedValue([])
      await service.listByDay(teacherK1, { date: '2026-05-14' })

      const arg = prisma.attendance.findMany.mock.calls[0][0]
      expect(arg.where.groupId.in).toEqual(expect.arrayContaining(['g1', 'g2']))
    })

    it('ADMIN фильтрует по садику через student', async () => {
      prisma.attendance.findMany.mockResolvedValue([])
      await service.listByDay(adminK1, { date: '2026-05-14' })

      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { kindergartenId: 'k1' },
          }),
        }),
      )
    })
  })

  describe('mark', () => {
    const dto = {
      studentId: 's1',
      date: '2026-05-14',
      status: 'PRESENT' as const,
    }

    it('404 если ученик не найден', async () => {
      prisma.student.findUnique.mockResolvedValue(null)
      await expect(service.mark(adminK1, dto)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('403 если ученик из другого садика', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k2',
      })
      await expect(service.mark(adminK1, dto)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('403 TEACHER не может отметить ребёнка чужой группы', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g999',
        kindergartenId: 'k1',
      })
      await expect(service.mark(teacherK1, dto)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('успешно делает upsert', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
      })
      prisma.attendance.upsert.mockResolvedValue({
        id: 'a1',
        status: 'PRESENT',
      })

      const res = await service.mark(teacherK1, dto)
      expect(res.status).toBe('PRESENT')
      expect(prisma.attendance.upsert).toHaveBeenCalled()
    })

    it('сохраняет markedById = текущий пользователь', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        groupId: 'g1',
        kindergartenId: 'k1',
      })
      prisma.attendance.upsert.mockResolvedValue({})

      await service.mark(teacherK1, dto)

      expect(prisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ markedById: 't' }),
          update: expect.objectContaining({ markedById: 't' }),
        }),
      )
    })

    describe('уведомление родителям об отсутствии', () => {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dushanbe',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())

      beforeEach(() => {
        prisma.student.findUnique.mockResolvedValue({
          id: 's1',
          groupId: 'g1',
          kindergartenId: 'k1',
        })
        prisma.attendance.upsert.mockResolvedValue({ id: 'a1' })
      })

      it('ABSENT сегодня → задание с задержкой и ключом «ученик + день»', async () => {
        await service.mark(teacherK1, { ...dto, date: today, status: 'ABSENT' })

        expect(noticeQ.add).toHaveBeenCalledWith(
          'absence',
          { studentId: 's1', date: today },
          expect.objectContaining({
            jobId: `absence-s1-${today}`,
            delay: expect.any(Number),
            // завершённое задание не должно навсегда занимать jobId: иначе «Нет» после исправления «Есть» не уведомит
            removeOnComplete: true,
          }),
        )
        expect(noticeQ.add.mock.calls[0][2].delay).toBeGreaterThan(0)
      })

      it.each(['PRESENT', 'SICK', 'VACATION'] as const)(
        '%s — родителей не беспокоим, новое задание не ставится',
        async (status) => {
          await service.mark(teacherK1, { ...dto, date: today, status })
          expect(noticeQ.add).not.toHaveBeenCalled()
        },
      )

      it('исправили «Нет» на «Есть» до отправки — ожидающее уведомление снимается', async () => {
        const pending = { isDelayed: jest.fn().mockResolvedValue(true), remove: jest.fn().mockResolvedValue(undefined) }
        noticeQ.getJob.mockResolvedValue(pending)

        await service.mark(teacherK1, { ...dto, date: today, status: 'PRESENT' })

        expect(noticeQ.getJob).toHaveBeenCalledWith(`absence-s1-${today}`)
        expect(pending.remove).toHaveBeenCalledTimes(1)
      })

      it('задание уже выполняется или выполнено — не трогаем', async () => {
        const running = { isDelayed: jest.fn().mockResolvedValue(false), remove: jest.fn() }
        noticeQ.getJob.mockResolvedValue(running)

        await service.mark(teacherK1, { ...dto, date: today, status: 'PRESENT' })

        expect(running.remove).not.toHaveBeenCalled()
      })

      it('ABSENT за прошлый день (правка журнала) — не уведомляем', async () => {
        await service.mark(teacherK1, { ...dto, date: '2020-01-10', status: 'ABSENT' })
        expect(noticeQ.add).not.toHaveBeenCalled()
      })

      it('сбой очереди (нет Redis) не ломает отметку', async () => {
        noticeQ.add.mockRejectedValue(new Error('redis down'))
        await expect(
          service.mark(teacherK1, { ...dto, date: today, status: 'ABSENT' }),
        ).resolves.toBeDefined()
        expect(prisma.attendance.upsert).toHaveBeenCalled()
      })
    })
  })
})
