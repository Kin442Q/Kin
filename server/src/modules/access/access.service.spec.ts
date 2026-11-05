import { Test } from '@nestjs/testing'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { AccessService, assertNoPassword, requireInviteEmail } from './access.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { PasswordTokensService } from '../password-tokens/password-tokens.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const admin: AuthUser = { sub: 'adm', email: 'adm@school.tj', role: 'ADMIN', kindergartenId: 'k1', groupId: null, childId: null }

describe('assertNoPassword', () => {
  it('пароль в запросе → 400 с объяснением; пустое тело и undefined — можно', () => {
    expect(() => assertNoPassword({ fullName: 'Х', password: 'abc12345' })).toThrow(BadRequestException)
    expect(() => assertNoPassword({ fullName: 'Х', password: 'abc12345' })).toThrow(/по ссылке из письма/)
    expect(() => assertNoPassword({ fullName: 'Х' })).not.toThrow()
    expect(() => assertNoPassword({ fullName: 'Х', password: undefined })).not.toThrow()
    expect(() => assertNoPassword(null)).not.toThrow()
    expect(() => assertNoPassword(undefined)).not.toThrow()
  })
})

describe('requireInviteEmail', () => {
  it('настоящий адрес — в нижнем регистре и без пробелов', () => {
    expect(requireInviteEmail('  Teacher@School.TJ ')).toBe('teacher@school.tj')
  })

  it('нет адреса, мусор или служебный адрес — 400: доступ выдаётся только письмом', () => {
    for (const bad of [undefined, null, '', '   ', 'не-почта', 'st1abc@students.local', 'staff-1@kindergarten.local', 'parent-1@no-email.local']) {
      expect(() => requireInviteEmail(bad)).toThrow(BadRequestException)
    }
    expect(() => requireInviteEmail('')).toThrow(/Укажите email/)
  })
})

describe('AccessService', () => {
  let service: AccessService
  let prisma: PrismaMock
  let mail: { send: jest.Mock }
  let tokens: { issue: jest.Mock }

  beforeEach(async () => {
    prisma = createPrismaMock()
    mail = { send: jest.fn().mockResolvedValue({ sent: true }) }
    tokens = { issue: jest.fn().mockResolvedValue({ token: 'tok', link: 'https://tahlilgar.cyou/set-password?token=tok', hours: 48 }) }
    const ref = await Test.createTestingModule({
      providers: [
        AccessService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: PasswordTokensService, useValue: tokens },
      ],
    }).compile()
    service = ref.get(AccessService)
  })

  describe('newSecret', () => {
    it('отдаёт только хеш: пароль никому не известен; каждый раз новый', async () => {
      const a = await service.newSecret()
      const b = await service.newSecret()

      expect(Object.keys(a)).toEqual(['hash'])
      expect(a.hash).toMatch(/^\$2[aby]\$/)
      expect(a.hash).not.toBe(b.hash)
    })
  })

  describe('deliver — письмо со ссылкой', () => {
    const account = { id: 'u1', email: 'teacher@school.tj', fullName: 'Рахимова Нигина' }

    it('приглашение: одноразовая ссылка в письме на адрес человека', async () => {
      const grant = await service.deliver(account)

      expect(grant).toEqual({ sent: true, email: 'teacher@school.tj' })
      expect(tokens.issue).toHaveBeenCalledWith('u1', 'INVITE')
      const sent = mail.send.mock.calls[0][0]
      expect(sent.to).toBe('teacher@school.tj')
      expect(sent.html).toContain('https://tahlilgar.cyou/set-password?token=tok')
    })

    it('смена пароля: ссылка типа RESET', async () => {
      await service.deliver(account, 'RESET')
      expect(tokens.issue).toHaveBeenCalledWith('u1', 'RESET')
    })

    it('письмо не ушло — аккаунт остаётся, причина видна, пароль не выдаётся', async () => {
      mail.send.mockResolvedValue({ sent: false, reason: 'NOT_CONFIGURED' })

      const grant = await service.deliver(account)

      expect(grant).toEqual({ sent: false, email: 'teacher@school.tj', reason: 'NOT_CONFIGURED', detail: undefined })
      expect(JSON.stringify(grant)).not.toMatch(/password/i)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('сбой при выдаче ссылки не роняет создание аккаунта', async () => {
      tokens.issue.mockRejectedValue(new Error('db down'))

      await expect(service.deliver(account)).resolves.toMatchObject({ sent: false, reason: 'NETWORK' })
    })
  })

  describe('sendLink — письмо от админа', () => {
    const teacher = {
      id: 't1',
      email: 'teacher@school.tj',
      fullName: 'Рахимова Нигина',
      role: 'TEACHER',
      kindergartenId: 'k1',
      lastLoginAt: null,
    }

    it('ещё не входил — приглашение; входил — ссылка для смены пароля; пароль не меняется', async () => {
      prisma.user.findUnique.mockResolvedValue(teacher)
      await service.sendLink(admin, 't1')
      expect(tokens.issue).toHaveBeenLastCalledWith('t1', 'INVITE')

      prisma.user.findUnique.mockResolvedValue({ ...teacher, lastLoginAt: new Date() })
      await service.sendLink(admin, 't1')
      expect(tokens.issue).toHaveBeenLastCalledWith('t1', 'RESET')
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('несуществующего пользователя нет — 404', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.sendLink(admin, 'x')).rejects.toThrow(NotFoundException)
    })

    it('человек из другой школы — 403', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...teacher, kindergartenId: 'k2' })
      await expect(service.sendLink(admin, 't1')).rejects.toThrow(ForbiddenException)
    })

    it('себе ссылку отсюда не шлют, директору и владельцу — нельзя', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...teacher, id: 'adm' })
      await expect(service.sendLink(admin, 'adm')).rejects.toThrow(/в настройках/)

      prisma.user.findUnique.mockResolvedValue({ ...teacher, role: 'SUPER_ADMIN' })
      await expect(service.sendLink(admin, 't1')).rejects.toThrow(BadRequestException)
    })

    it('без настоящего email — 400 с подсказкой добавить почту', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...teacher, email: 'st1@students.local' })
      await expect(service.sendLink(admin, 't1')).rejects.toThrow(/не указан email/)
    })
  })
})
