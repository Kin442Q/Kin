import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import bcrypt from 'bcryptjs'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { StudentsService } from './students.service'
import { StudentLinkService } from '../student-links/student-link.service'
import { AccessService } from '../access/access.service'
import { createAccessMock } from '../../test-utils/access-mock'
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

const account = (patch: Record<string, unknown> = {}) => ({
  id: 'u1',
  isActive: true,
  lastLoginAt: null,
  linkVersion: 1,
  ...patch,
})

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

const tokenOf = (link: string) => link.split('/s/')[1]

describe('StudentsService — доступ ученика по личной ссылке', () => {
  let service: StudentsService
  let links: StudentLinkService
  let prisma: PrismaMock

  beforeEach(async () => {
    prisma = createPrismaMock()
    const config = {
      get: (k: string) =>
        ({ 'jwt.studentLinkSecret': 'test-link-secret-123456', 'mail.appUrl': 'https://tahlilgar.cyou' })[k],
    }
    const ref = await Test.createTestingModule({
      providers: [
        StudentsService,
        StudentLinkService,
        { provide: AccessService, useValue: createAccessMock() },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile()
    service = ref.get(StudentsService)
    links = ref.get(StudentLinkService)

    prisma.student.findUnique.mockResolvedValue(student())
    prisma.user.findUnique.mockResolvedValue(null) // служебный логин свободен
    prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => account({ id: 'u-new', linkVersion: data.linkVersion }))
    prisma.user.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
      account({ id: where.id, linkVersion: data.linkVersion }),
    )
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  describe('кто может выдавать доступ', () => {
    const actions: Array<[string, (u: AuthUser) => Promise<unknown>]> = [
      ['getAccount', (u) => service.getAccount('st1', u)],
      ['createAccount', (u) => service.createAccount('st1', u)],
      ['regenerateLink', (u) => service.regenerateLink('st1', u)],
      ['removeAccount', (u) => service.removeAccount('st1', u)],
    ]

    it.each(actions)('%s: админ школы и классный руководитель — можно', async (_name, run) => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account() }))
      await expect(run(admin)).resolves.not.toThrow()
      await expect(run(homeroom)).resolves.not.toThrow()
    })

    it.each(actions)('%s: учитель не этого класса и админ другой школы — отказ', async (_name, run) => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account() }))
      await expect(run(otherTeacher)).rejects.toThrow(ForbiddenException)
      await expect(run(adminOtherSchool)).rejects.toThrow(ForbiddenException)
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.user.delete).not.toHaveBeenCalled()
    })

    it('несуществующий ученик — 404', async () => {
      prisma.student.findUnique.mockResolvedValue(null)
      await expect(service.getAccount('nope', admin)).rejects.toThrow(NotFoundException)
    })
  })

  describe('getAccount', () => {
    it('нет аккаунта — null', async () => {
      expect(await service.getAccount('st1', admin)).toBeNull()
    })

    it('есть ссылка: в ответе подписанная ссылка, а не логин и пароль', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account({ linkVersion: 2 }) }))
      const res = await service.getAccount('st1', admin)

      expect(res).toMatchObject({ id: 'u1', isActive: true, lastLoginAt: null })
      expect(res?.link).toMatch(/^https:\/\/tahlilgar\.cyou\/s\/u1\./)
      expect(links.verify(tokenOf(res!.link!), 2)).toBe(true)
      expect(links.verify(tokenOf(res!.link!), 1)).toBe(false) // это ссылка версии 2
      expect(res).not.toHaveProperty('login')
      expect(res).not.toHaveProperty('password')
    })

    it('старый аккаунт без ссылки: link = null', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account({ linkVersion: null }) }))
      expect((await service.getAccount('st1', admin))?.link).toBeNull()
    })
  })

  describe('createAccount — выдать ссылку', () => {
    it('создаёт аккаунт со случайным паролем, без логина из тела, с версией 1', async () => {
      const res = await service.createAccount('st1', homeroom)

      const data = prisma.user.create.mock.calls[0][0].data
      expect(data).toMatchObject({ role: 'STUDENT', studentId: 'st1', kindergartenId: 'k1', isActive: true, linkVersion: 1, fullName: 'Али Каримов' })
      expect(data.email).toMatch(/^st[0-9a-z]{6}@students\.local$/)
      expect(data.passwordHash).toMatch(/^\$2[aby]\$/)
      expect(res.link).toMatch(/^https:\/\/tahlilgar\.cyou\/s\/u-new\./)
      expect(links.verify(tokenOf(res.link!), 1)).toBe(true)
      expect(res).not.toHaveProperty('password')
    })

    it('у каждого ученика свой случайный пароль, его никто не знает', async () => {
      await service.createAccount('st1', admin)
      await service.createAccount('st1', admin)
      const [a, b] = prisma.user.create.mock.calls.map((c) => c[0].data.passwordHash)
      expect(a).not.toBe(b)
      expect(await bcrypt.compare('', a)).toBe(false)
    })

    it('архивному ученику ссылку не выдаём (400)', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ status: 'ARCHIVED' }))
      await expect(service.createAccount('st1', admin)).rejects.toThrow(BadRequestException)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('ссылка уже выдана: повторный вызов возвращает её же, ничего не создаёт', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account({ linkVersion: 3 }) }))
      const res = await service.createAccount('st1', admin)

      expect(links.verify(tokenOf(res.link!), 3)).toBe(true)
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('старый аккаунт без ссылки (с логином и паролем): получает ссылку версии 1', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account({ linkVersion: null }) }))
      const res = await service.createAccount('st1', admin)

      expect(prisma.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'u1' }, data: { linkVersion: 1, isActive: true } })
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(links.verify(tokenOf(res.link!), 1)).toBe(true)
    })
  })

  describe('regenerateLink — перевыпуск', () => {
    it('нет аккаунта — 404', async () => {
      await expect(service.regenerateLink('st1', admin)).rejects.toThrow(NotFoundException)
    })

    it('версия растёт, старая ссылка перестаёт подходить, сессии ученика закрыты', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account({ linkVersion: 2 }) }))
      const oldLink = links.link('u1', 2)

      const res = await service.regenerateLink('st1', homeroom)

      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ linkVersion: 3, isActive: true })
      const revoke = prisma.refreshToken.updateMany.mock.calls[0][0]
      expect(revoke.where).toEqual({ userId: 'u1', revokedAt: null })
      expect(revoke.data.revokedAt).toBeInstanceOf(Date)

      expect(links.verify(tokenOf(res.link!), 3)).toBe(true)
      expect(links.verify(tokenOf(oldLink), 3)).toBe(false) // старая не подходит к новой версии
      expect(res.link).not.toBe(oldLink)
    })

    it('аккаунт без ссылки: перевыпуск даёт версию 1', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account({ linkVersion: null }) }))
      await service.regenerateLink('st1', admin)
      expect(prisma.user.update.mock.calls[0][0].data.linkVersion).toBe(1)
    })
  })

  describe('removeAccount', () => {
    it('удаляет аккаунт, ученик остаётся; без аккаунта — ничего', async () => {
      prisma.student.findUnique.mockResolvedValue(student({ account: account() }))
      await service.removeAccount('st1', admin)
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })

      prisma.user.delete.mockClear()
      prisma.student.findUnique.mockResolvedValue(student())
      await service.removeAccount('st1', admin)
      expect(prisma.user.delete).not.toHaveBeenCalled()
    })
  })

  describe('ссылки класса (печать карточек)', () => {
    const group = { id: 'g1', name: '7А', kindergartenId: 'k1', homeroomTeacherId: 't1' }
    const row = (id: string, last: string, acc: unknown) => ({ id, firstName: 'Имя', lastName: last, kindergartenId: 'k1', account: acc })

    beforeEach(() => {
      prisma.group.findUnique.mockResolvedValue(group)
      prisma.student.findMany.mockResolvedValue([
        row('s1', 'Алиев', account({ id: 'u1', linkVersion: 1, lastLoginAt: new Date('2026-11-01T10:00:00Z') })),
        row('s2', 'Бобоев', null),
        row('s3', 'Саидов', account({ id: 'u3', linkVersion: null })),
      ])
    })

    it('классный руководитель и админ видят список; чужой учитель и админ другой школы — отказ', async () => {
      await expect(service.classLinks('g1', homeroom)).resolves.toBeDefined()
      await expect(service.classLinks('g1', admin)).resolves.toBeDefined()
      await expect(service.classLinks('g1', otherTeacher)).rejects.toThrow(ForbiddenException)
      await expect(service.classLinks('g1', adminOtherSchool)).rejects.toThrow(ForbiddenException)
    })

    it('без groupId — 400, несуществующий класс — 404', async () => {
      await expect(service.classLinks(undefined, admin)).rejects.toThrow(BadRequestException)
      prisma.group.findUnique.mockResolvedValue(null)
      await expect(service.classLinks('nope', admin)).rejects.toThrow(NotFoundException)
    })

    it('в списке: ссылка у кого выдана, null у остальных, когда заходил; только действующие ученики по фамилии', async () => {
      const res = await service.classLinks('g1', homeroom)

      expect(res.group).toEqual({ id: 'g1', name: '7А' })
      expect(res.students.map((s) => s.studentId)).toEqual(['s1', 's2', 's3'])
      expect(res.students[0].link).toMatch(/^https:\/\/tahlilgar\.cyou\/s\/u1\./)
      expect(res.students[0].lastLoginAt).toEqual(new Date('2026-11-01T10:00:00Z'))
      expect(res.students[1].link).toBeNull()
      expect(res.students[2].link).toBeNull()

      const q = prisma.student.findMany.mock.calls[0][0]
      expect(q.where).toEqual({ groupId: 'g1', status: 'ACTIVE' })
      expect(q.orderBy).toEqual([{ lastName: 'asc' }, { firstName: 'asc' }])
    })

    it('«выдать всем»: создаёт аккаунт тем, у кого его нет, и ссылку тем, у кого аккаунт без ссылки; остальных не трогает', async () => {
      const res = await service.issueClassLinks('g1', homeroom)

      expect(prisma.user.create).toHaveBeenCalledTimes(1) // s2
      expect(prisma.user.create.mock.calls[0][0].data.studentId).toBe('s2')
      expect(prisma.user.update).toHaveBeenCalledTimes(1) // s3
      expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'u3' })
      expect(res.students).toHaveLength(3)
      expect(prisma.student.findMany).toHaveBeenCalledTimes(2) // до выдачи и итоговый список
    })

    it('«выдать всем» чужому учителю недоступно', async () => {
      await expect(service.issueClassLinks('g1', otherTeacher)).rejects.toThrow(ForbiddenException)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })
  })
})
