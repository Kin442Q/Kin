import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import bcrypt from 'bcryptjs'
import { UnauthorizedException } from '@nestjs/common'
import { createHash } from 'node:crypto'

import { AuthService } from './auth.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { NotificationsService } from '../notifications/notifications.service'
import { FeaturesService } from '../features/features.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

describe('AuthService', () => {
  let service: AuthService
  let prisma: PrismaMock
  let jwt: { signAsync: jest.Mock }
  let redis: { set: jest.Mock }
  let notifications: { send: jest.Mock }
  let features: { enabledKeys: jest.Mock; isEnabled: jest.Mock }

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

    const config = {
      get: (k: string) => {
        const map: Record<string, string> = {
          'jwt.accessSecret': 'a-secret',
          'jwt.refreshSecret': 'r-secret',
          'jwt.accessTtl': '15m',
          'jwt.refreshTtl': '30d',
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
      ],
    }).compile()

    service = moduleRef.get(AuthService)
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

    it('ученик входит, если кабинет ученика включён; studentId попадает в токен и ответ', async () => {
      const hash = await bcrypt.hash('pw1234', 4)
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        role: 'STUDENT',
        studentId: 'st1',
        email: 'st1@students.local',
        passwordHash: hash,
      })
      prisma.user.update.mockResolvedValue(fakeUser)
      prisma.refreshToken.create.mockResolvedValue({})

      const res = await service.login({ email: 'st1@students.local', password: 'pw1234' }, {})

      expect(features.isEnabled).toHaveBeenCalledWith('k1', 'portal')
      expect(res.user.studentId).toBe('st1')
      expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ role: 'STUDENT', studentId: 'st1' })
    })

    it('ученик не входит, если кабинет ученика выключен для школы → 401, токены не выдаются', async () => {
      const hash = await bcrypt.hash('pw1234', 4)
      prisma.user.findUnique.mockResolvedValue({ ...fakeUser, role: 'STUDENT', studentId: 'st1', passwordHash: hash })
      features.isEnabled = jest.fn().mockResolvedValue(false)

      await expect(service.login({ email: 'admin@kg.tj', password: 'pw1234' }, {})).rejects.toThrow(
        UnauthorizedException,
      )
      expect(jwt.signAsync).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
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
  })
})
