import { Test } from '@nestjs/testing'
import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import {
  BULK_DELETE_CHUNK,
  BULK_DELETE_MAX,
  StudentsBulkDeleteService,
} from './students-bulk-delete.service'
import { StudentsController } from './students.controller'
import { StudentsService } from './students.service'
import { RolesGuard } from '../../common/guards/roles.guard'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const adminK1: AuthUser = {
  sub: 'admin',
  email: 'admin@school.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}
const teacherK1: AuthUser = { ...adminK1, sub: 't', role: 'TEACHER', groupId: 'g1' }
const superAdmin: AuthUser = { ...adminK1, sub: 'root', role: 'SUPER_ADMIN', kindergartenId: null }

/** n учеников своей школы: s1…sn */
const mineIds = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `s${from + i}`)
const own = (ids: string[], kindergartenId = 'k1') => ids.map((id) => ({ id, kindergartenId }))

describe('StudentsBulkDeleteService — пакетное удаление учеников', () => {
  let service: StudentsBulkDeleteService
  let prisma: PrismaMock
  let redis: { delByPattern: jest.Mock }

  beforeEach(async () => {
    prisma = createPrismaMock()
    redis = { delByPattern: jest.fn().mockResolvedValue(undefined) }
    const ref = await Test.createTestingModule({
      providers: [
        StudentsBulkDeleteService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile()
    service = ref.get(StudentsBulkDeleteService)
    // по умолчанию deleteMany удаляет столько, сколько попросили
    prisma.student.deleteMany.mockImplementation(async ({ where }: any) => ({ count: where.id.in.length }))
    prisma.user.deleteMany.mockResolvedValue({ count: 0 })
    prisma.auditLog.create.mockResolvedValue({})
  })

  describe('права', () => {
    it('учитель не может: 403, база не трогается', async () => {
      await expect(service.bulkDelete(teacherK1, ['s1'])).rejects.toThrow(ForbiddenException)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
      expect(prisma.student.deleteMany).not.toHaveBeenCalled()
    })

    it.each([
      ['родитель', 'PARENT'],
      ['ученик', 'STUDENT'],
      ['наблюдатель', 'VIEWER'],
    ])('%s не может', async (_n, role) => {
      await expect(
        service.bulkDelete({ ...adminK1, role: role as AuthUser['role'] }, ['s1']),
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.student.deleteMany).not.toHaveBeenCalled()
    })

    it('на самом маршруте стоит @Roles(SUPER_ADMIN, ADMIN): RolesGuard не пускает учителя', () => {
      const guard = new RolesGuard(new Reflector())
      const ctxFor = (role: string) =>
        ({
          getHandler: () => StudentsController.prototype.bulkDeleteStudents,
          getClass: () => StudentsController,
          switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
        }) as unknown as ExecutionContext

      expect(() => guard.canActivate(ctxFor('TEACHER'))).toThrow(ForbiddenException)
      expect(() => guard.canActivate(ctxFor('PARENT'))).toThrow(ForbiddenException)
      expect(guard.canActivate(ctxFor('ADMIN'))).toBe(true)
      expect(guard.canActivate(ctxFor('SUPER_ADMIN'))).toBe(true)
    })

    it('контроллер передаёт в сервис ids из тела и пользователя', async () => {
      const bulk = { bulkDelete: jest.fn().mockResolvedValue({ deleted: 1, failed: [] }) }
      const ref = await Test.createTestingModule({
        controllers: [StudentsController],
        providers: [
          { provide: StudentsService, useValue: {} },
          { provide: StudentsBulkDeleteService, useValue: bulk },
        ],
      }).compile()
      const controller = ref.get(StudentsController)
      await expect(controller.bulkDeleteStudents({ ids: ['s1'] }, adminK1)).resolves.toEqual({
        deleted: 1,
        failed: [],
      })
      expect(bulk.bulkDelete).toHaveBeenCalledWith(adminK1, ['s1'])
    })
  })

  describe('проверка списка', () => {
    it('пустой список: 400', async () => {
      await expect(service.bulkDelete(adminK1, [])).rejects.toThrow(BadRequestException)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
    })

    it('не список (нет ids в теле): 400', async () => {
      await expect(service.bulkDelete(adminK1, undefined)).rejects.toThrow(BadRequestException)
      await expect(service.bulkDelete(adminK1, 'abc')).rejects.toThrow(BadRequestException)
    })

    it('в списке не строки: 400, ничего не удаляется', async () => {
      await expect(service.bulkDelete(adminK1, ['s1', 42])).rejects.toThrow(BadRequestException)
      await expect(service.bulkDelete(adminK1, ['s1', ''])).rejects.toThrow(BadRequestException)
      expect(prisma.student.deleteMany).not.toHaveBeenCalled()
    })

    it(`больше ${BULK_DELETE_MAX} id за раз: 400, ничего не удаляется`, async () => {
      const tooMany = mineIds(BULK_DELETE_MAX + 1)
      await expect(service.bulkDelete(adminK1, tooMany)).rejects.toThrow(BadRequestException)
      expect(prisma.student.findMany).not.toHaveBeenCalled()
      expect(prisma.student.deleteMany).not.toHaveBeenCalled()
    })

    it(`ровно ${BULK_DELETE_MAX} id проходят`, async () => {
      const ids = mineIds(BULK_DELETE_MAX)
      prisma.student.findMany.mockResolvedValue(own(ids))
      const r = await service.bulkDelete(adminK1, ids)
      expect(r).toEqual({ deleted: BULK_DELETE_MAX, failed: [] })
    })

    it('повторяющиеся id считаются один раз', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1', 's2']))
      const r = await service.bulkDelete(adminK1, ['s1', 's2', 's1', ' s2 '])
      expect(r).toEqual({ deleted: 2, failed: [] })
      expect(prisma.student.deleteMany).toHaveBeenCalledTimes(1)
      expect(prisma.student.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1', 's2'] } } })
    })
  })

  describe('чужие и несуществующие', () => {
    it('ученик другой школы не удаляется и попадает в отчёт', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', kindergartenId: 'k1' },
        { id: 'alien', kindergartenId: 'k2' },
      ])
      const r = await service.bulkDelete(adminK1, ['s1', 'alien'])
      expect(r.deleted).toBe(1)
      expect(r.failed).toEqual([{ id: 'alien', reason: 'Ученик не найден' }])
      // в базу на удаление ушёл только свой
      expect(prisma.student.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1'] } } })
    })

    it('несуществующий id попадает в отчёт с той же причиной, что и чужой', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1']))
      const r = await service.bulkDelete(adminK1, ['s1', 'ghost'])
      expect(r.deleted).toBe(1)
      expect(r.failed).toEqual([{ id: 'ghost', reason: 'Ученик не найден' }])
    })

    it('если все id чужие или несуществующие — ничего не удаляется, кэш не трогается', async () => {
      prisma.student.findMany.mockResolvedValue([{ id: 'alien', kindergartenId: 'k2' }])
      const r = await service.bulkDelete(adminK1, ['alien', 'ghost'])
      expect(r.deleted).toBe(0)
      expect(r.failed.map((f) => f.id)).toEqual(['alien', 'ghost'])
      expect(prisma.student.deleteMany).not.toHaveBeenCalled()
      expect(prisma.user.deleteMany).not.toHaveBeenCalled()
      expect(redis.delByPattern).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('глобальный SUPER_ADMIN без школы может удалить ученика любой школы (как одиночное удаление)', async () => {
      prisma.student.findMany.mockResolvedValue([{ id: 'a', kindergartenId: 'k2' }])
      const r = await service.bulkDelete(superAdmin, ['a'])
      expect(r).toEqual({ deleted: 1, failed: [] })
    })
  })

  describe('удаление', () => {
    it('удаляет учеников и их личные входы (STUDENT) в одной транзакции', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1', 's2']))
      await service.bulkDelete(adminK1, ['s1', 's2'])
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({
        where: { role: 'STUDENT', studentId: { in: ['s1', 's2'] } },
      })
      expect(prisma.student.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1', 's2'] } } })
      // порядок: сначала вход ученика, потом сам ученик
      const userOrder = prisma.user.deleteMany.mock.invocationCallOrder[0]
      const studentOrder = prisma.student.deleteMany.mock.invocationCallOrder[0]
      expect(userOrder).toBeLessThan(studentOrder)
    })

    it('учителей и родителей не трогает: удаляет только аккаунты с ролью STUDENT', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1']))
      await service.bulkDelete(adminK1, ['s1'])
      const where = prisma.user.deleteMany.mock.calls[0][0].where
      expect(where.role).toBe('STUDENT')
      expect(prisma.user.delete).not.toHaveBeenCalled()
    })

    it(`300 учеников идут пачками по ${BULK_DELETE_CHUNK}, а не одной транзакцией`, async () => {
      const ids = mineIds(300)
      prisma.student.findMany.mockResolvedValue(own(ids))
      const r = await service.bulkDelete(adminK1, ids)
      expect(r).toEqual({ deleted: 300, failed: [] })
      expect(prisma.$transaction).toHaveBeenCalledTimes(3)
      const sizes = prisma.student.deleteMany.mock.calls.map((c: any[]) => c[0].where.id.in.length)
      expect(sizes).toEqual([100, 100, 100])
    })

    it('250 учеников: пачки 100 + 100 + 50', async () => {
      const ids = mineIds(250)
      prisma.student.findMany.mockResolvedValue(own(ids))
      await service.bulkDelete(adminK1, ids)
      const sizes = prisma.student.deleteMany.mock.calls.map((c: any[]) => c[0].where.id.in.length)
      expect(sizes).toEqual([100, 100, 50])
    })

    it('транзакции дан запас по времени', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1']))
      await service.bulkDelete(adminK1, ['s1'])
      expect(prisma.$transaction.mock.calls[0][1]).toEqual({ timeout: 60_000 })
    })

    it('считает реально удалённых: если кого-то уже удалили параллельно, лишнего не обещает', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1', 's2', 's3']))
      prisma.student.deleteMany.mockResolvedValue({ count: 2 })
      const r = await service.bulkDelete(adminK1, ['s1', 's2', 's3'])
      expect(r.deleted).toBe(2)
    })
  })

  describe('сбой в пачке', () => {
    it('пачка не прошла: разбираем по одному, проблемный попадает в failed с причиной, остальные удалены', async () => {
      const ids = mineIds(5)
      prisma.student.findMany.mockResolvedValue(own(ids))
      prisma.student.deleteMany.mockImplementation(async ({ where }: any) => {
        const list: string[] = where.id.in
        if (list.length > 1 || list.includes('s3')) throw new Error('boom\nforeign key violation')
        return { count: 1 }
      })
      const r = await service.bulkDelete(adminK1, ids)
      expect(r.deleted).toBe(4)
      expect(r.failed).toEqual([{ id: 's3', reason: 'Не удалось удалить, попробуйте ещё раз' }])
    })

    it('в причину не попадает текст ошибки базы', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1']))
      prisma.student.deleteMany.mockRejectedValue(new Error('Invalid `prisma.student.deleteMany()` invocation: secret'))
      const r = await service.bulkDelete(adminK1, ['s1'])
      expect(r.deleted).toBe(0)
      expect(JSON.stringify(r.failed)).not.toContain('prisma')
      expect(JSON.stringify(r.failed)).not.toContain('secret')
    })
  })

  describe('после удаления', () => {
    it('сбрасывает кэш панелей, финансов и аналитики своей школы', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1']))
      await service.bulkDelete(adminK1, ['s1'])
      const patterns = redis.delByPattern.mock.calls.map((c: any[]) => c[0]).sort()
      expect(patterns).toEqual(
        [
          'analytics:dashboard:k1:*',
          'analytics:profitability:k1:*',
          'analytics:trend:k1:*',
          'finance:global:k1:*',
          'finance:group:k1:*',
        ].sort(),
      )
    })

    it('сбой Redis не ломает ответ', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1']))
      redis.delByPattern.mockRejectedValue(new Error('redis down'))
      await expect(service.bulkDelete(adminK1, ['s1'])).resolves.toEqual({ deleted: 1, failed: [] })
    })

    it('пишет в журнал, кто и сколько удалил (только числа и id)', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1', 's2']))
      await service.bulkDelete(adminK1, ['s1', 's2', 'ghost'])
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin',
          action: 'DELETE',
          entity: 'StudentBulkDelete',
          entityId: 'k1',
          diff: { requested: 3, deleted: 2, ids: ['s1', 's2'] },
        },
      })
    })

    it('сбой записи в журнал не ломает ответ', async () => {
      prisma.student.findMany.mockResolvedValue(own(['s1']))
      prisma.auditLog.create.mockRejectedValue(new Error('db'))
      await expect(service.bulkDelete(adminK1, ['s1'])).resolves.toEqual({ deleted: 1, failed: [] })
    })
  })
})
