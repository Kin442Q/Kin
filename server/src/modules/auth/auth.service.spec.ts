import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import bcrypt from 'bcryptjs'
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common'
import { createHash } from 'node:crypto'

import { AuthService } from './auth.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { NotificationsService } from '../notifications/notifications.service'
import { FeaturesService } from '../features/features.service'
import { MailService } from '../mail/mail.service'
import { PasswordTokensService } from '../password-tokens/password-tokens.service'
import { StudentLinkService } from '../student-links/student-link.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

describe('AuthService', () => {
  let service: AuthService
  let prisma: PrismaMock
  let jwt: { signAsync: jest.Mock }
  let redis: { set: jest.Mock }
  let notifications: { send: jest.Mock }
  let features: { enabledKeys: jest.Mock; isEnabled: jest.Mock }
  let mail: { isConfigured: jest.Mock; send: jest.Mock }
  let tokens: { hasRecent: jest.Mock; issue: jest.Mock }
  let links: StudentLinkService

  const fakeUser = {
    id: 'u1',
    email: 'admin@kg.tj',
    passwordHash: '',
    fullName: 'Admin User',
    role: 'ADMIN',
    kindergartenId: 'k1',
    groupId: null,
    childId: null,
    phone: '+992901112233',
    isActive: true,
    lastLoginAt: null,
    mustChangePassword: false,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    prisma = createPrismaMock()
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    }
    redis = { set: jest.fn() }
    notifications = { send: jest.fn() }
    features = {
      enabledKeys: jest.fn().mockResolvedValue(['groups', 'chat']),
      isEnabled: jest.fn().mockResolvedValue(true),
    }

    // Почта по умолчанию выключена: прежние сценарии (уведомление админам) не меняются.
    mail = { isConfigured: jest.fn().mockReturnValue(false), send: jest.fn().mockResolvedValue({ sent: true }) }
    tokens = {
      hasRecent: jest.fn().mockResolvedValue(false),
      issue: jest.fn().mockResolvedValue({ token: 'tok', link: 'https://x.test/set-password?token=tok', hours: 2 }),
    }

    const config = {
      get: (k: string) => {
        const map: Record<string, string> = {
          'jwt.accessSecret': 'a-secret',
          'jwt.refreshSecret': 'r-secret',
          'jwt.accessTtl': '15m',
          'jwt.refreshTtl': '30d',
          'jwt.studentLinkSecret': 'test-link-secret-123456',
          'mail.appUrl': 'https://tahlilgar.cyou',
        }
        return map[k]
      },
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: NotificationsService, useValue: notifications },
        { provide: FeaturesService, useValue: features },
        { provide: MailService, useValue: mail },
        { provide: PasswordTokensService, useValue: tokens },
        StudentLinkService,
      ],
    }).compile()

    service = moduleRef.get(AuthService)
    links = moduleRef.get(StudentLinkService)
  })

  describe('login', () => {
    it('успешный вход по email', async () => {
      const hash = await bcrypt.hash('secret123', 4)
      prisma.user.findUnique.mockResolvedValue({ ...fakeUser, passwordHash: hash })
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await service.login(
        { email: 'admin@kg.tj', password: 'secret123' },
        {},
      )

      expect(res.accessToken).toBe('signed-token')
      expect(res.refreshToken).toBe('signed-token')
      expect(res.user.email).toBe('admin@kg.tj')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@kg.tj' },
      })
    })

    it('успешный вход по телефону', async () => {
      const hash = await bcrypt.hash('secret123', 4)
      prisma.user.findMany.mockResolvedValue([
        { ...fakeUser, passwordHash: hash },
      ])
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await service.login(
        { phone: '+992901112233', password: 'secret123' },
        {},
      )

      expect(res.accessToken).toBeTruthy()
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { phone: '+992901112233', isActive: true },
      })
    })

    it('вход по телефону: один номер в двух школах — выбирается тот, чей пароль подошёл', async () => {
      const hashA = await bcrypt.hash('passwordA', 4)
      const hashB = await bcrypt.hash('passwordB', 4)
      prisma.user.findMany.mockResolvedValue([
        { ...fakeUser, id: 'uA', kindergartenId: 'kA', passwordHash: hashA },
        { ...fakeUser, id: 'uB', kindergartenId: 'kB', passwordHash: hashB },
      ])
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await service.login(
        { phone: '+992901112233', password: 'passwordB' },
        {},
      )

      expect(res.user.id).toBe('uB')
      expect(res.user.kindergartenId).toBe('kB')
    })

    it('вход по телефону: 401, если пароль подошёл нескольким аккаунтам', async () => {
      const hash = await bcrypt.hash('same-pass', 4)
      prisma.user.findMany.mockResolvedValue([
        { ...fakeUser, id: 'uA', passwordHash: hash },
        { ...fakeUser, id: 'uB', passwordHash: hash },
      ])
      await expect(
        service.login({ phone: '+992901112233', password: 'same-pass' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('вход по телефону: 401 при неверном пароле', async () => {
      const hash = await bcrypt.hash('right', 4)
      prisma.user.findMany.mockResolvedValue([{ ...fakeUser, passwordHash: hash }])
      await expect(
        service.login({ phone: '+992901112233', password: 'wrong' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('ученик по логину и паролю не входит даже с верным паролем: подсказка про ссылку, токены не выдаются', async () => {
      const hash = await bcrypt.hash('pw1234', 4)
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        role: 'STUDENT',
        studentId: 'st1',
        email: 'st1@students.local',
        passwordHash: hash,
      })

      await expect(service.login({ email: 'st1@students.local', password: 'pw1234' }, {})).rejects.toThrow(
        /Ученики входят по личной ссылке от классного руководителя/,
      )
      expect(jwt.signAsync).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('ученику с неверным паролем — та же подсказка (а не «неверный пароль»); и по телефону тоже не войти', async () => {
      const hash = await bcrypt.hash('pw1234', 4)
      const studentRow = { ...fakeUser, role: 'STUDENT', studentId: 'st1', passwordHash: hash }
      prisma.user.findUnique.mockResolvedValue(studentRow)
      await expect(service.login({ email: 'admin@kg.tj', password: 'wrong' }, {})).rejects.toThrow(/личной ссылке/)

      prisma.user.findMany.mockResolvedValue([studentRow])
      await expect(service.login({ phone: '+992901112233', password: 'pw1234' }, {})).rejects.toThrow(/личной ссылке/)
      expect(jwt.signAsync).not.toHaveBeenCalled()
    })

    it('выключенный кабинет ученика не мешает входить учителям и админам', async () => {
      const hash = await bcrypt.hash('pw1234', 4)
      prisma.user.findUnique.mockResolvedValue({ ...fakeUser, passwordHash: hash })
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})
      features.isEnabled = jest.fn().mockResolvedValue(false)

      await expect(service.login({ email: 'admin@kg.tj', password: 'pw1234' }, {})).resolves.toBeDefined()
    })
    it('401 если пользователь не найден', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.login({ email: 'x@y.z', password: 'p' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('401 если пользователь деактивирован', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        isActive: false,
      })
      await expect(
        service.login({ email: 'admin@kg.tj', password: 'p' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('401 если пароль неверный', async () => {
      const hash = await bcrypt.hash('rightpass', 4)
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        passwordHash: hash,
      })
      await expect(
        service.login(
          { email: 'admin@kg.tj', password: 'wrongpass' },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('401 если не указан ни email, ни телефон', async () => {
      await expect(service.login({ password: 'p' }, {})).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('JWT должен включать kindergartenId', async () => {
      const hash = await bcrypt.hash('secret123', 4)
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        passwordHash: hash,
      })
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      await service.login(
        { email: 'admin@kg.tj', password: 'secret123' },
        {},
      )

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'u1',
          kindergartenId: 'k1',
          role: 'ADMIN',
        }),
        expect.anything(),
      )
    })

    it('Глобальный супер-админ имеет kindergartenId: null в JWT', async () => {
      const hash = await bcrypt.hash('secret123', 4)
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        kindergartenId: null,
        role: 'SUPER_ADMIN',
        passwordHash: hash,
      })
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      await service.login(
        { email: 'owner@kg.tj', password: 'secret123' },
        {},
      )

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ kindergartenId: null }),
        expect.anything(),
      )
    })
  })

  describe('mustChangePassword — временный пароль от админа', () => {
    it('вход по временному паролю: флаг «сменить пароль» приходит в ответе', async () => {
      const hash = await bcrypt.hash('Temp-pass-123', 4)
      prisma.user.findUnique.mockResolvedValue({ ...fakeUser, passwordHash: hash, mustChangePassword: true })
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await service.login({ email: 'admin@kg.tj', password: 'Temp-pass-123' }, {})

      expect(res.user.mustChangePassword).toBe(true)
    })

    it('обычный вход: флаг false', async () => {
      const hash = await bcrypt.hash('secret123', 4)
      prisma.user.findUnique.mockResolvedValue({ ...fakeUser, passwordHash: hash })
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await service.login({ email: 'admin@kg.tj', password: 'secret123' }, {})

      expect(res.user.mustChangePassword).toBe(false)
    })
  })

  describe('changePassword', () => {
    const setup = async (patch: Record<string, unknown> = {}) => {
      const hash = await bcrypt.hash('old-password-1', 4)
      prisma.user.findUnique.mockResolvedValue({ ...fakeUser, passwordHash: hash, ...patch })
      prisma.user.update.mockResolvedValue({})
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 })
      prisma.refreshToken.create.mockResolvedValue({})
    }

    it('меняет пароль: новый хеш подходит, флаг смены снят, прежние сессии закрыты, этому устройству выдана новая', async () => {
      await setup({ mustChangePassword: true })

      const res = await service.changePassword('u1', { currentPassword: 'old-password-1', newPassword: 'new-password-2' }, {})

      const update = prisma.user.update.mock.calls[0][0]
      expect(update.where).toEqual({ id: 'u1' })
      expect(await bcrypt.compare('new-password-2', update.data.passwordHash)).toBe(true)
      expect(update.data.mustChangePassword).toBe(false)
      expect(prisma.refreshToken.updateMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'u1', revokedAt: null } })
      expect(res.accessToken).toBe('signed-token')
      expect(res.user.mustChangePassword).toBe(false)
      expect(JSON.stringify(res.user)).not.toContain('passwordHash')
    })

    it('неверный текущий пароль → 400 (не 401: клиент не должен выбросить человека из системы), ничего не меняется', async () => {
      await setup()

      await expect(service.changePassword('u1', { currentPassword: 'wrong', newPassword: 'new-password-2' }, {})).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
    })

    it('новый пароль короче 8 символов → 400', async () => {
      await setup()
      await expect(service.changePassword('u1', { currentPassword: 'old-password-1', newPassword: 'short' }, {})).rejects.toThrow(/минимум 8/)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('новый пароль такой же, как текущий → 400', async () => {
      await setup()
      await expect(
        service.changePassword('u1', { currentPassword: 'old-password-1', newPassword: 'old-password-1' }, {}),
      ).rejects.toThrow(/отличаться/)
    })

    it('у ученика пароля нет → 400 с подсказкой про ссылку', async () => {
      await setup({ role: 'STUDENT' })
      await expect(
        service.changePassword('u1', { currentPassword: 'old-password-1', newPassword: 'new-password-2' }, {}),
      ).rejects.toThrow(/личной ссылке/)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('отключённый или несуществующий аккаунт → 401', async () => {
      await setup({ isActive: false })
      await expect(
        service.changePassword('u1', { currentPassword: 'old-password-1', newPassword: 'new-password-2' }, {}),
      ).rejects.toThrow(UnauthorizedException)

      prisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.changePassword('u1', { currentPassword: 'old-password-1', newPassword: 'new-password-2' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('changeEmail', () => {
    const setup = async (patch: Record<string, unknown> = {}) => {
      const hash = await bcrypt.hash('old-password-1', 4)
      prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) =>
        where.id === 'u1' ? { ...fakeUser, passwordHash: hash, ...patch } : null,
      )
      prisma.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...fakeUser, ...data }))
      prisma.refreshToken.create.mockResolvedValue({})
    }
    const dto = { currentPassword: 'old-password-1', newEmail: 'New@School.TJ' }

    it('меняет email: в нижнем регистре, выдаётся новый токен с новым адресом', async () => {
      await setup()

      const res = await service.changeEmail('u1', dto, {})

      expect(prisma.user.update.mock.calls[0][0]).toEqual({ where: { id: 'u1' }, data: { email: 'new@school.tj' } })
      expect(res.user.email).toBe('new@school.tj')
      expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ email: 'new@school.tj' })
    })

    it('неверный текущий пароль → 400 (не 401), email не меняется', async () => {
      await setup()
      await expect(service.changeEmail('u1', { ...dto, currentPassword: 'wrong' }, {})).rejects.toThrow(BadRequestException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('не настоящий адрес (служебный .local, мусор) → 400', async () => {
      await setup()
      await expect(service.changeEmail('u1', { ...dto, newEmail: 'st1@students.local' }, {})).rejects.toThrow(/настоящий email/)
      await expect(service.changeEmail('u1', { ...dto, newEmail: 'не-почта' }, {})).rejects.toThrow(/настоящий email/)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('тот же email → 400; чужой занятый → 409', async () => {
      await setup()
      await expect(service.changeEmail('u1', { ...dto, newEmail: 'ADMIN@kg.tj' }, {})).rejects.toThrow(/уже ваш/)

      prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) =>
        where.id === 'u1' ? { ...fakeUser, passwordHash: await bcrypt.hash('old-password-1', 4) } : { id: 'someone' },
      )
      await expect(service.changeEmail('u1', dto, {})).rejects.toThrow(ConflictException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('ученик → 400 с подсказкой про ссылку', async () => {
      await setup({ role: 'STUDENT' })
      await expect(service.changeEmail('u1', dto, {})).rejects.toThrow(/личной ссылке/)
    })
  })

  describe('loginWithStudentLink', () => {
    const studentUser = {
      ...fakeUser,
      id: 'stu1',
      email: 'st1@students.local',
      role: 'STUDENT',
      studentId: 'st1',
      linkVersion: 2,
    }
    const DEAD = /Ссылка не работает/

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(studentUser)
      prisma.student.findUnique.mockResolvedValue({ status: 'ACTIVE' })
      prisma.user.update.mockResolvedValue(studentUser)
      prisma.refreshToken.create.mockResolvedValue({})
    })

    it('верная ссылка: токены выданы, studentId в токене и ответе, lastLoginAt обновлён, раздел «кабинет» проверен', async () => {
      const res = await service.loginWithStudentLink(links.token('stu1', 2), { userAgent: 'ua' })

      expect(res.accessToken).toBe('signed-token')
      expect(res.user.studentId).toBe('st1')
      expect(res.user.role).toBe('STUDENT')
      expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ role: 'STUDENT', studentId: 'st1', sub: 'stu1' })
      expect(features.isEnabled).toHaveBeenCalledWith('k1', 'portal')
      expect(prisma.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'stu1' } })
      expect(prisma.user.update.mock.calls[0][0].data.lastLoginAt).toBeInstanceOf(Date)
    })

    it('мусор вместо токена: отказ без обращения к базе', async () => {
      for (const bad of ['', 'abc', 'no-dot-here-at-all-just-text-0000', 'stu1.short', 'stu1.' + 'x'.repeat(40)]) {
        await expect(service.loginWithStudentLink(bad, {})).rejects.toThrow(DEAD)
      }
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('подделка подписи, чужая подпись и подмена userId — отказ', async () => {
      const good = links.token('stu1', 2)
      const tampered = good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A')
      await expect(service.loginWithStudentLink(tampered, {})).rejects.toThrow(DEAD)

      // подпись от другого пользователя к чужому id
      const otherSig = links.token('stu2', 2).split('.')[1]
      await expect(service.loginWithStudentLink('stu1.' + otherSig, {})).rejects.toThrow(DEAD)
      expect(jwt.signAsync).not.toHaveBeenCalled()
    })

    it('ссылка старой версии (после перевыпуска) не работает, новая работает', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...studentUser, linkVersion: 3 })

      await expect(service.loginWithStudentLink(links.token('stu1', 2), {})).rejects.toThrow(DEAD)
      await expect(service.loginWithStudentLink(links.token('stu1', 3), {})).resolves.toBeDefined()
    })

    it('отозванный доступ (linkVersion null), неактивный и несуществующий аккаунт — отказ', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...studentUser, linkVersion: null })
      await expect(service.loginWithStudentLink(links.token('stu1', 2), {})).rejects.toThrow(DEAD)

      prisma.user.findUnique.mockResolvedValue({ ...studentUser, isActive: false })
      await expect(service.loginWithStudentLink(links.token('stu1', 2), {})).rejects.toThrow(DEAD)

      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.loginWithStudentLink(links.token('stu1', 2), {})).rejects.toThrow(DEAD)
      expect(jwt.signAsync).not.toHaveBeenCalled()
    })

    it('ссылкой нельзя войти в аккаунт НЕ ученика (админ, учитель, родитель)', async () => {
      for (const role of ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'PARENT']) {
        prisma.user.findUnique.mockResolvedValue({ ...studentUser, id: 'adm1', role, linkVersion: 1 })
        await expect(service.loginWithStudentLink(links.token('adm1', 1), {})).rejects.toThrow(DEAD)
      }
      expect(jwt.signAsync).not.toHaveBeenCalled()
    })

    it('ученик в архиве (ушёл из школы) — ссылка не пускает', async () => {
      prisma.student.findUnique.mockResolvedValue({ status: 'ARCHIVED' })
      await expect(service.loginWithStudentLink(links.token('stu1', 2), {})).rejects.toThrow(DEAD)

      prisma.student.findUnique.mockResolvedValue(null)
      await expect(service.loginWithStudentLink(links.token('stu1', 2), {})).rejects.toThrow(DEAD)
    })

    it('раздел «Кабинет ученика» выключен для школы — не пускает, токены не выдаются', async () => {
      features.isEnabled = jest.fn().mockResolvedValue(false)

      await expect(service.loginWithStudentLink(links.token('stu1', 2), {})).rejects.toThrow(/Кабинет ученика отключён/)
      expect(jwt.signAsync).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('все причины отказа выглядят одинаково: по ответу не понять, что именно не так', async () => {
      const messages = new Set<string>()
      const attempt = async (setup: () => void, token: string) => {
        setup()
        try {
          await service.loginWithStudentLink(token, {})
        } catch (e) {
          messages.add((e as Error).message)
        }
      }
      await attempt(() => prisma.user.findUnique.mockResolvedValue(null), links.token('stu1', 2))
      await attempt(() => prisma.user.findUnique.mockResolvedValue({ ...studentUser, linkVersion: null }), links.token('stu1', 2))
      await attempt(() => prisma.user.findUnique.mockResolvedValue({ ...studentUser, linkVersion: 9 }), links.token('stu1', 2))
      await attempt(() => prisma.user.findUnique.mockResolvedValue({ ...studentUser, role: 'ADMIN' }), links.token('stu1', 2))
      await attempt(() => prisma.user.findUnique.mockResolvedValue(studentUser), 'garbage')
      expect(messages.size).toBe(1)
    })
  })

  describe('refresh', () => {
    const hashToken = (s: string) =>
      createHash('sha256').update(s).digest('hex')

    it('401 если refresh-token не найден в БД', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null)
      await expect(
        service.refresh({ sub: 'u1', jti: 'jti1', raw: 'r' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('401 если refresh-token отозван', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        tokenHash: hashToken('r'),
      })
      await expect(
        service.refresh({ sub: 'u1', jti: 'jti1', raw: 'r' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('401 если refresh-token истёк', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        tokenHash: hashToken('r'),
      })
      await expect(
        service.refresh({ sub: 'u1', jti: 'jti1', raw: 'r' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('401 если хэш не совпадает (попытка подмены) + отзывает все токены', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        tokenHash: hashToken('correct'),
      })
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

      await expect(
        service.refresh({ sub: 'u1', jti: 'jti1', raw: 'wrong' }, {}),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('успешно обновляет токены и отзывает старый', async () => {
      const raw = 'old-refresh-token'
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        tokenHash: hashToken(raw),
      })
      prisma.refreshToken.update.mockResolvedValue({})
      prisma.user.findUniqueOrThrow.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await service.refresh(
        { sub: 'u1', jti: 'jti1', raw },
        {},
      )

      expect(res.accessToken).toBe('signed-token')
      // Старый токен помечен revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    })
  })

  describe('logout', () => {
    it('отзывает refresh-token по jti', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })
      await service.logout('u1', 'jti-refresh')

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', jti: 'jti-refresh', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    })

    it('добавляет access-token в Redis blacklist', async () => {
      await service.logout('u1', undefined, 'access-jti')

      expect(redis.set).toHaveBeenCalledWith(
        'jwt:blacklist:access-jti',
        true,
        15 * 60,
      )
    })

    it('делает оба действия если переданы оба jti', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })
      await service.logout('u1', 'refresh-jti', 'access-jti')

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled()
      expect(redis.set).toHaveBeenCalled()
    })

    it('не падает если ничего не передано', async () => {
      await expect(service.logout('u1')).resolves.toBeUndefined()
    })
  })

  describe('requestPasswordReset', () => {
    it('уведомляет администраторов учреждения, когда пользователь найден', async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser)
      prisma.user.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])

      const res = await service.requestPasswordReset({ email: 'admin@kg.tj' })

      expect(res.ok).toBe(true)
      expect(notifications.send).toHaveBeenCalledTimes(2)
      expect(notifications.send).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ title: 'Запрос на сброс пароля' }),
      )
    })

    it('возвращает generic-ответ и не шлёт уведомлений, если аккаунт не найден', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      const res = await service.requestPasswordReset({ email: 'no@one.tj' })

      expect(res.ok).toBe(true)
      expect(notifications.send).not.toHaveBeenCalled()
    })

    it('не ходит в БД, если не указан ни email, ни телефон', async () => {
      const res = await service.requestPasswordReset({})

      expect(res.ok).toBe(true)
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(notifications.send).not.toHaveBeenCalled()
    })

    describe('с настроенной почтой', () => {
      beforeEach(() => {
        mail.isConfigured.mockReturnValue(true)
        prisma.user.findUnique.mockResolvedValue(fakeUser)
        prisma.user.findMany.mockResolvedValue([{ id: 'a1' }])
      })

      it('шлёт письмо со ссылкой сброса, администраторов не тревожит', async () => {
        const res = await service.requestPasswordReset({ email: 'admin@kg.tj' })

        expect(res.ok).toBe(true)
        expect(tokens.issue).toHaveBeenCalledWith('u1', 'RESET')
        expect(mail.send).toHaveBeenCalledTimes(1)
        const msg = mail.send.mock.calls[0][0]
        expect(msg.to).toBe('admin@kg.tj')
        expect(msg.text).toContain('https://x.test/set-password?token=tok')
        expect(msg.html).toContain('https://x.test/set-password?token=tok')
        expect(notifications.send).not.toHaveBeenCalled()
      })

      it('письмо не ушло — запасной путь: уведомление администраторам', async () => {
        mail.send.mockResolvedValue({ sent: false, reason: 'REJECTED' })

        const res = await service.requestPasswordReset({ email: 'admin@kg.tj' })

        expect(res.ok).toBe(true)
        expect(notifications.send).toHaveBeenCalledWith('a1', expect.objectContaining({ title: 'Запрос на сброс пароля' }))
      })

      it('ученическому логину @students.local письмо не шлём — только администратору', async () => {
        prisma.user.findUnique.mockResolvedValue({ ...fakeUser, email: 'st7k2m9x@students.local', role: 'STUDENT' })

        await service.requestPasswordReset({ email: 'st7k2m9x@students.local' })

        expect(mail.send).not.toHaveBeenCalled()
        expect(tokens.issue).not.toHaveBeenCalled()
        expect(notifications.send).toHaveBeenCalledTimes(1)
      })

      it('повторный запрос в течение минуты ничего не шлёт и не раскрывает этого', async () => {
        tokens.hasRecent.mockResolvedValue(true)

        const res = await service.requestPasswordReset({ email: 'admin@kg.tj' })

        expect(res.ok).toBe(true)
        expect(tokens.issue).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
        expect(notifications.send).not.toHaveBeenCalled()
      })

      it('отключённому пользователю и несуществующему аккаунту — тот же ответ, письма нет', async () => {
        const found = await service.requestPasswordReset({ email: 'admin@kg.tj' })
        prisma.user.findUnique.mockResolvedValue({ ...fakeUser, isActive: false })
        const inactive = await service.requestPasswordReset({ email: 'admin@kg.tj' })
        prisma.user.findUnique.mockResolvedValue(null)
        const missing = await service.requestPasswordReset({ email: 'no@one.tj' })

        expect(inactive).toEqual(found)
        expect(missing).toEqual(found)
        expect(mail.send).toHaveBeenCalledTimes(1) // только для первого
      })

      it('сбой выдачи токена не роняет запрос: администратор всё равно получает уведомление', async () => {
        tokens.issue.mockRejectedValue(new Error('db down'))

        await expect(service.requestPasswordReset({ email: 'admin@kg.tj' })).resolves.toMatchObject({ ok: true })
        expect(mail.send).not.toHaveBeenCalled()
        expect(notifications.send).toHaveBeenCalledWith('a1', expect.objectContaining({ title: 'Запрос на сброс пароля' }))
      })
    })
  })
})
