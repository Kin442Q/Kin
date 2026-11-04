import { ForbiddenException } from '@nestjs/common'

import { ClassAccessService } from './class-access.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const user = (patch: Partial<AuthUser>): AuthUser => ({
  sub: 'u1',
  email: 'u@kg.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
  ...patch,
})

describe('ClassAccessService', () => {
  let prisma: PrismaMock
  let service: ClassAccessService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new ClassAccessService(prisma as unknown as PrismaService)
  })

  describe('assertStaffAccess', () => {
    const group = { id: 'g1', kindergartenId: 'k1' }

    it('админ своей школы проходит в любой класс', async () => {
      await expect(service.assertStaffAccess(user({ role: 'ADMIN' }), group)).resolves.toBeUndefined()
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('админ другой школы — 403', async () => {
      await expect(
        service.assertStaffAccess(user({ role: 'ADMIN', kindergartenId: 'k2' }), group),
      ).rejects.toThrow(ForbiddenException)
    })

    it('учитель проходит в основной и в «дополнительный» класс', async () => {
      prisma.user.findUnique.mockResolvedValue({ groupId: 'g0', teachingGroups: [{ id: 'g1' }] })
      await expect(service.assertStaffAccess(user({}), group)).resolves.toBeUndefined()
    })

    it('учитель не проходит в чужой класс', async () => {
      prisma.user.findUnique.mockResolvedValue({ groupId: 'g0', teachingGroups: [] })
      await expect(service.assertStaffAccess(user({}), group)).rejects.toThrow(ForbiddenException)
    })

    it('родитель и ученик не работают с классом как сотрудники', async () => {
      await expect(service.assertStaffAccess(user({ role: 'PARENT' }), group)).rejects.toThrow(ForbiddenException)
      await expect(service.assertStaffAccess(user({ role: 'STUDENT' }), group)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('assertHomeroomAccess', () => {
    const group = { id: 'g1', kindergartenId: 'k1', homeroomTeacherId: 't1' }

    it('классный руководитель этого класса проходит без запроса в БД', async () => {
      await expect(service.assertHomeroomAccess(user({ sub: 't1' }), group)).resolves.toBeUndefined()
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('обычный учитель того же класса — 403', async () => {
      await expect(service.assertHomeroomAccess(user({ sub: 't2' }), group)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('класс без руководителя: учитель — 403, админ — проходит', async () => {
      const orphan = { ...group, homeroomTeacherId: null }
      await expect(service.assertHomeroomAccess(user({ sub: 't1' }), orphan)).rejects.toThrow(ForbiddenException)
      await expect(service.assertHomeroomAccess(user({ role: 'ADMIN' }), orphan)).resolves.toBeUndefined()
    })

    it('руководитель из другой школы — 403', async () => {
      await expect(
        service.assertHomeroomAccess(user({ sub: 't1', kindergartenId: 'k2' }), group),
      ).rejects.toThrow(ForbiddenException)
    })
  })
})
