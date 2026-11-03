import { Test } from '@nestjs/testing'
import bcrypt from 'bcryptjs'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { StudentsService } from './students.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base: Omit<AuthUser, 'sub' | 'role'> = {
  email: 'x@s.tj',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
}
const admin: AuthUser = { ...base, sub: 'adm', role: 'ADMIN' }
const homeroom: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }
const otherTeacher: AuthUser = { ...base, sub: 't2', role: 'TEACHER' }
const adminOtherSchool: AuthUser = { ...base, sub: 'adm2', role: 'ADMIN', kindergartenId: 'k2' }

const student = (patch: Record<string, unknown> = {}) => ({
  id: 'st1',
  firstName: 'Али',
  lastName: 'Каримов',
  status: 'ACTIVE',
  kindergartenId: 'k1',
  group: { homeroomTeacherId: 't1' },
  account: null,
  ...patch,
})

describe('StudentsService — аккаунт ученика', () => {
  let service: StudentsService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const ref = await Test.createTestingModule({
      providers: [StudentsService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = ref.get(StudentsService)
    prisma.student.findUnique.mockResolvedValue(student())
    prisma.user.findUnique.mockResolvedValue(null) // логин свободен
    prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'u-new',
      email: data.email,
      isActive: true,
      lastLoginAt: null,
    }))
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  describe('кто может выдавать доступ', () => {
    it('админ своей школы — да', async () => {
      await expect(service.createAccount('st1', {}, admin)).resolves.toBeDefined()
    })

    it('классный руководитель этого класса — да', async () => {
      await expect(service.createAccount('st1', {}, homeroom)).resolves.toBeDefined()
    })

    it('обычный учитель того же класса — нет (403), аккаунт не создан', async () => {
      await expect(service.createAccount('st1', {}, otherTeacher)).rejects.toThrow(ForbiddenException)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('админ другой школы — нет (403)', async () => {
      await expect(service.createAccount('st1', {}, adminOtherSchool)).rejects.toThrow(ForbiddenException)
    })

    it('несуществующий ученик → 404', async () => {
      prisma.student.findUnique.mockResolvedValue(null)
      await expect(service.createAccount('nope', {}, admin)).rejects.toThrow(NotFoundException)
    })
  })

  describe('createAccount', () => {
    it('создаёт STUDENT, привязанного к ученику и школе; пароль отдаётся один раз', async () => {
      const r = await service.createAccount('st1', {}, admin)

      const data = prisma.user.create.mock.calls[0][0].data
      expect(data).toMatchObject({
        role: 'STUDENT',
        studentId: 'st1',
        kindergartenId: 'k1',
        fullName: 'Али Каримов',
        isActive: true,
      })
      expect(data.email).toMatch(/^st[0-9a-z]{6}@students\.local$/)
      expect(r.account.login).toBe(data.email)
      expect(r.password).toHaveLength(8)
      // в БД лежит хеш, а не сам пароль
      expect(data.passwordHash).not.toBe(r.password)
      expect(await bcrypt.compare(r.password, data.passwordHash)).toBe(true)
    })

    it('свой логин без «@» дополняется доменом и приводится к нижнему регистру', async () => {
      const r = await service.createAccount('st1', { login: ' Ali.Karimov ', password: 'secret1' }, admin)
      expect(r.account.login).toBe('ali.karimov@students.local')
      expect(r.password).toBe('secret1')
    })

    it('занятый логин → 409', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'someone' })
      await expect(service.createAccount('st1', { login: 'ali' }, admin)).rejects.toThrow(ConflictException)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('недопустимый логин → 400', async () => {
      await expect(service.createAccount('st1', { login: 'Али Каримов!' }, admin)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('короткий пароль → 400', async () => {
      await expect(service.createAccount('st1', { password: '123' }, admin)).rejects.toThrow(BadRequestException)
    })

    it('у ученика уже есть аккаунт → 409', async () => {
      prisma.student.findUnique.mockResolvedValue(
        student({ account: { id: 'u1', email: 'a@students.local', isActive: true, lastLoginAt: null } }),
      )
      await expect(service.createAccount('st1', {}, admin)).rejects.toThrow(ConflictException)
    })

    it('отчисленному ученику аккаунт не создаётся → 400', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ status: 'ARCHIVED' }))
      await expect(service.createAccount('st1', {}, admin)).rejects.toThrow(BadRequestException)
    })
  })

  describe('getAccount / resetAccountPassword / removeAccount', () => {
    const withAccount = () =>
      student({ account: { id: 'u1', email: 'st123456@students.local', isActive: true, lastLoginAt: null } })

    it('getAccount: null, пока аккаунта нет', async () => {
      expect(await service.getAccount('st1', admin)).toBeNull()
    })

    it('getAccount: логин и статус (без хеша пароля)', async () => {
      prisma.student.findUnique.mockResolvedValue(withAccount())
      expect(await service.getAccount('st1', admin)).toEqual({
        id: 'u1',
        login: 'st123456@students.local',
        isActive: true,
        lastLoginAt: null,
      })
    })

    it('сброс пароля: новый хеш, старые сессии отозваны, пароль отдаётся один раз', async () => {
      prisma.student.findUnique.mockResolvedValue(withAccount())
      prisma.user.update.mockReturnValue('u')
      prisma.refreshToken.updateMany.mockReturnValue('t')

      const r = await service.resetAccountPassword('st1', {}, homeroom)

      expect(r.password).toHaveLength(8)
      const upd = prisma.user.update.mock.calls[0][0]
      expect(upd.where).toEqual({ id: 'u1' })
      expect(await bcrypt.compare(r.password, upd.data.passwordHash)).toBe(true)
      expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', revokedAt: null })
    })

    it('сброс пароля без аккаунта → 404', async () => {
      await expect(service.resetAccountPassword('st1', {}, admin)).rejects.toThrow(NotFoundException)
    })

    it('removeAccount удаляет только аккаунт; нет аккаунта — тихо ничего', async () => {
      prisma.student.findUnique.mockResolvedValue(withAccount())
      await service.removeAccount('st1', admin)
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })

      prisma.user.delete.mockClear()
      prisma.student.findUnique.mockResolvedValue(student())
      await service.removeAccount('st1', admin)
      expect(prisma.user.delete).not.toHaveBeenCalled()
    })

    it('чужой учитель не сбрасывает пароль', async () => {
      prisma.student.findUnique.mockResolvedValue(withAccount())
      await expect(service.resetAccountPassword('st1', {}, otherTeacher)).rejects.toThrow(ForbiddenException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })
})
