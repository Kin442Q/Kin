import { BadRequestException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'

import {
  INVITE_TTL_HOURS,
  PasswordTokensService,
  RESET_TTL_HOURS,
  isRealEmail,
  maskEmail,
} from './password-tokens.service'
import { SetPasswordDto } from '../auth/dto/set-password.dto'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

const HOUR = 60 * 60 * 1000
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('PasswordTokensService', () => {
  let prisma: PrismaMock
  let service: PasswordTokensService

  beforeEach(() => {
    prisma = createPrismaMock()
    const config = { get: (k: string) => (k === 'mail.appUrl' ? 'https://tahlilgar.cyou' : undefined) }
    service = new PasswordTokensService(prisma as unknown as PrismaService, config as unknown as ConfigService)
  })

  describe('issue', () => {
    it('в базу попадает только sha256 токена, а ссылка ведёт на страницу установки пароля', async () => {
      const { token, link, hours } = await service.issue('u1', 'INVITE')

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/) // 32 байта в base64url
      expect(link).toBe(`https://tahlilgar.cyou/set-password?token=${token}`)
      expect(hours).toBe(INVITE_TTL_HOURS)

      const data = prisma.passwordToken.create.mock.calls[0][0].data
      expect(data.tokenHash).toBe(sha(token))
      expect(data.userId).toBe('u1')
      expect(data.purpose).toBe('INVITE')
      expect(JSON.stringify(data)).not.toContain(token)
    })

    it('приглашение живёт 48 часов, сброс — 2 часа', async () => {
      const before = Date.now()
      await service.issue('u1', 'INVITE')
      await service.issue('u1', 'RESET')
      const [invite, reset] = prisma.passwordToken.create.mock.calls.map((c) => c[0].data.expiresAt.getTime() - before)

      expect(invite).toBeGreaterThanOrEqual(48 * HOUR - 50)
      expect(invite).toBeLessThan(48 * HOUR + 5000)
      expect(reset).toBeGreaterThanOrEqual(2 * HOUR - 50)
      expect(reset).toBeLessThan(2 * HOUR + 5000)
      expect(RESET_TTL_HOURS).toBe(2)
    })

    it('прежние неиспользованные ссылки пользователя гасятся: действует только последняя', async () => {
      await service.issue('u1', 'RESET')

      const burn = prisma.passwordToken.updateMany.mock.calls[0][0]
      expect(burn.where).toEqual({ userId: 'u1', usedAt: null })
      expect(burn.data.usedAt).toBeInstanceOf(Date)
    })

    it('каждый токен уникален', async () => {
      const a = await service.issue('u1', 'RESET')
      const b = await service.issue('u1', 'RESET')
      expect(a.token).not.toBe(b.token)
    })
  })

  describe('hasRecent', () => {
    it('смотрит токены того же назначения за последние секунды', async () => {
      prisma.passwordToken.count.mockResolvedValue(1)
      await expect(service.hasRecent('u1', 'RESET', 60)).resolves.toBe(true)
      const where = prisma.passwordToken.count.mock.calls[0][0].where
      expect(where.userId).toBe('u1')
      expect(where.purpose).toBe('RESET')
      expect(Date.now() - where.createdAt.gt.getTime()).toBeGreaterThanOrEqual(59_000)

      prisma.passwordToken.count.mockResolvedValue(0)
      await expect(service.hasRecent('u1', 'RESET')).resolves.toBe(false)
    })
  })

  describe('inspect', () => {
    const live = {
      id: 't1',
      userId: 'u1',
      purpose: 'INVITE',
      usedAt: null,
      expiresAt: new Date(Date.now() + HOUR),
      user: { email: 'director@school.tj', isActive: true },
    }

    it('живая ссылка: назначение, срок и замаскированный email', async () => {
      prisma.passwordToken.findUnique.mockResolvedValue(live)

      const res = await service.inspect('raw-token')

      expect(res).toEqual({ valid: true, purpose: 'INVITE', email: 'di***@school.tj', expiresAt: live.expiresAt })
      expect(prisma.passwordToken.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: sha('raw-token') })
    })

    it('неизвестная, использованная, просроченная ссылка и отключённый пользователь', async () => {
      prisma.passwordToken.findUnique.mockResolvedValue(null)
      expect(await service.inspect('x')).toEqual({ valid: false, reason: 'INVALID' })

      prisma.passwordToken.findUnique.mockResolvedValue({ ...live, usedAt: new Date() })
      expect(await service.inspect('x')).toEqual({ valid: false, reason: 'USED' })

      prisma.passwordToken.findUnique.mockResolvedValue({ ...live, expiresAt: new Date(Date.now() - 1000) })
      expect(await service.inspect('x')).toEqual({ valid: false, reason: 'EXPIRED' })

      prisma.passwordToken.findUnique.mockResolvedValue({ ...live, user: { email: 'a@b.tj', isActive: false } })
      expect(await service.inspect('x')).toEqual({ valid: false, reason: 'INVALID' })
    })
  })

  describe('consume', () => {
    const row = {
      id: 't1',
      userId: 'u1',
      purpose: 'INVITE',
      usedAt: null,
      expiresAt: new Date(Date.now() + HOUR),
      user: { isActive: true },
    }

    beforeEach(() => {
      prisma.passwordToken.findUnique.mockResolvedValue(row)
      prisma.passwordToken.updateMany.mockResolvedValue({ count: 1 })
      prisma.user.update.mockResolvedValue({})
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 })
    })

    it('успех: пароль сохраняется хешем, ссылка гасится, остальные ссылки и все сессии тоже', async () => {
      await expect(service.consume('raw-token', 'Новый-пароль-1')).resolves.toEqual({ ok: true })

      // токен погашен атомарно (условие usedAt: null защищает от повторного использования)
      const claim = prisma.passwordToken.updateMany.mock.calls[0][0]
      expect(claim.where).toMatchObject({ id: 't1', usedAt: null })
      expect(claim.data.usedAt).toBeInstanceOf(Date)

      // в базу уходит bcrypt-хеш, а не сам пароль
      const hash = prisma.user.update.mock.calls[0][0].data.passwordHash
      expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'u1' })
      expect(hash).not.toContain('Новый-пароль-1')
      expect(await bcrypt.compare('Новый-пароль-1', hash)).toBe(true)

      // остальные ссылки пользователя погашены
      expect(prisma.passwordToken.updateMany.mock.calls[1][0].where).toEqual({ userId: 'u1', usedAt: null })
      // все сессии отозваны
      const revoke = prisma.refreshToken.updateMany.mock.calls[0][0]
      expect(revoke.where).toEqual({ userId: 'u1', revokedAt: null })
      expect(revoke.data.revokedAt).toBeInstanceOf(Date)
    })

    it('пароль короче 8 символов — отказ, до базы дело не доходит', async () => {
      await expect(service.consume('raw-token', '1234567')).rejects.toThrow(/минимум 8/)
      expect(prisma.passwordToken.findUnique).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('неизвестный, использованный, просроченный токен и отключённый пользователь — один и тот же отказ', async () => {
      const attempts = [
        null,
        { ...row, usedAt: new Date() },
        { ...row, expiresAt: new Date(Date.now() - 1000) },
        { ...row, user: { isActive: false } },
      ]
      for (const found of attempts) {
        prisma.passwordToken.findUnique.mockResolvedValue(found)
        await expect(service.consume('raw-token', 'Хороший-пароль-1')).rejects.toThrow(BadRequestException)
        await expect(service.consume('raw-token', 'Хороший-пароль-1')).rejects.toThrow(/недействительна или устарела/)
      }
      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
    })

    it('гонка: если токен уже забрал другой запрос, пароль не меняется', async () => {
      prisma.passwordToken.updateMany.mockResolvedValueOnce({ count: 0 })

      await expect(service.consume('raw-token', 'Хороший-пароль-1')).rejects.toThrow(/недействительна или устарела/)

      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
    })
  })
})

describe('isRealEmail / maskEmail', () => {
  it('ученические логины и мусор — не настоящая почта', () => {
    expect(isRealEmail('director@school.tj')).toBe(true)
    expect(isRealEmail('st7k2m9x@students.local')).toBe(false)
    expect(isRealEmail('ST7K2M9X@Students.Local')).toBe(false)
    expect(isRealEmail('staff-1730000000000@kindergarten.local')).toBe(false)
    expect(isRealEmail('parent-1-abc@no-email.local')).toBe(false)
    expect(isRealEmail('no-at-sign')).toBe(false)
    expect(isRealEmail('')).toBe(false)
    expect(isRealEmail(null)).toBe(false)
    expect(isRealEmail(undefined)).toBe(false)
  })

  it('маска показывает начало и домен, но не весь адрес', () => {
    expect(maskEmail('director@school.tj')).toBe('di***@school.tj')
    expect(maskEmail('a@b.tj')).toBe('a***@b.tj')
    expect(maskEmail('ab@b.tj')).toBe('a***@b.tj')
    expect(maskEmail('weird')).toBe('***')
  })
})

describe('SetPasswordDto', () => {
  const check = (obj: Record<string, unknown>) => validate(plainToInstance(SetPasswordDto, obj))

  it('токен и пароль от 8 символов обязательны', async () => {
    expect(await check({ token: 'x'.repeat(43), password: '12345678' })).toHaveLength(0)
    expect((await check({ token: 'x'.repeat(43), password: '1234567' })).length).toBeGreaterThan(0)
    expect((await check({ token: 'short', password: '12345678' })).length).toBeGreaterThan(0)
    expect((await check({ password: '12345678' })).length).toBeGreaterThan(0)
    expect((await check({ token: 'x'.repeat(43), password: 'a'.repeat(129) })).length).toBeGreaterThan(0)
  })
})
