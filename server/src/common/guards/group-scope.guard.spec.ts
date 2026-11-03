import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { GroupScopeGuard } from './group-scope.guard'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

function ctxFor(user: unknown, params: Record<string, string> = { id: 'g2' }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params, query: {}, body: {} }) }),
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext
}

describe('GroupScopeGuard', () => {
  let prisma: PrismaMock
  let guard: GroupScopeGuard

  beforeEach(() => {
    prisma = createPrismaMock()
    // Каст через unknown: не заставляем ts-jest сравнивать огромные типы Prisma.
    guard = new GroupScopeGuard(new Reflector(), prisma as unknown as PrismaService)
  })

  it('админ проходит без проверки класса', async () => {
    await expect(guard.canActivate(ctxFor({ role: 'ADMIN' }))).resolves.toBe(true)
    expect(prisma.user.count).not.toHaveBeenCalled()
  })

  it('учитель проходит в основной класс без запроса в БД', async () => {
    const user = { role: 'TEACHER', sub: 't1', groupId: 'g2' }
    await expect(guard.canActivate(ctxFor(user))).resolves.toBe(true)
    expect(prisma.user.count).not.toHaveBeenCalled()
  })

  it('учитель проходит в любой из классов, которые ведёт (teachingGroups)', async () => {
    prisma.user.count.mockResolvedValue(1)
    const user = { role: 'TEACHER', sub: 't1', groupId: 'g1' }
    await expect(guard.canActivate(ctxFor(user))).resolves.toBe(true)
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { id: 't1', teachingGroups: { some: { id: 'g2' } } },
    })
  })

  it('учитель не проходит в чужой класс', async () => {
    prisma.user.count.mockResolvedValue(0)
    const user = { role: 'TEACHER', sub: 't1', groupId: 'g1' }
    await expect(guard.canActivate(ctxFor(user))).rejects.toThrow(ForbiddenException)
  })

  it('без id класса — 403', async () => {
    const user = { role: 'TEACHER', sub: 't1', groupId: 'g1' }
    await expect(guard.canActivate(ctxFor(user, {}))).rejects.toThrow(ForbiddenException)
  })
})
