import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { PasswordTokenPurpose } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'

/** Сколько часов живёт ссылка-приглашение и ссылка сброса пароля. */
export const INVITE_TTL_HOURS = 48
export const RESET_TTL_HOURS = 2
export const MIN_PASSWORD_LENGTH = 8

const HOUR_MS = 60 * 60 * 1000
const INVALID_LINK = 'Ссылка недействительна или устарела. Запросите новую.'

const TTL_HOURS: Record<PasswordTokenPurpose, number> = {
  INVITE: INVITE_TTL_HOURS,
  RESET: RESET_TTL_HOURS,
}

/** Настоящий email, на который можно писать (ученические логины @students.local — нет). */
export function isRealEmail(email?: string | null): email is string {
  if (!email) return false
  // Служебные адреса, которые система придумывает сама (@students.local, @kindergarten.local,
  // @no-email.local), заканчиваются на .local — письмом их не достать.
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !email.toLowerCase().endsWith('.local')
}

/** «ab***@gmail.com» — подтверждаем человеку, чей это аккаунт, не раскрывая адрес целиком. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}***@${domain}`
}

export type TokenInspection =
  | { valid: true; purpose: PasswordTokenPurpose; email: string; expiresAt: Date }
  | { valid: false; reason: 'INVALID' | 'EXPIRED' | 'USED' }

/**
 * Одноразовые ссылки «задать пароль» (приглашение и сброс). В базе лежит
 * только sha256 токена, сам токен знает лишь получатель письма.
 */
@Injectable()
export class PasswordTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  link(token: string): string {
    const base = this.config.get<string>('mail.appUrl') || 'https://tahlilgar.cyou'
    return `${base}/set-password?token=${encodeURIComponent(token)}`
  }

  /**
   * Выдать новый токен. Прежние неиспользованные токены этого пользователя
   * гасим: действует только последняя ссылка.
   */
  async issue(userId: string, purpose: PasswordTokenPurpose) {
    const now = new Date()
    const hours = TTL_HOURS[purpose]
    const token = randomBytes(32).toString('base64url')

    await this.prisma.passwordToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    })
    await this.prisma.passwordToken.create({
      data: {
        userId,
        purpose,
        tokenHash: this.hash(token),
        expiresAt: new Date(now.getTime() + hours * HOUR_MS),
      },
    })
    return { token, link: this.link(token), hours }
  }

  /** Не слали ли ссылку этому пользователю совсем недавно (защита от спама на чужую почту). */
  async hasRecent(userId: string, purpose: PasswordTokenPurpose, seconds = 60): Promise<boolean> {
    const n = await this.prisma.passwordToken.count({
      where: { userId, purpose, createdAt: { gt: new Date(Date.now() - seconds * 1000) } },
    })
    return n > 0
  }

  /** Проверка ссылки до ввода пароля: чтобы страница сразу сказала, что ссылка мертва. */
  async inspect(token: string): Promise<TokenInspection> {
    const row = await this.prisma.passwordToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { select: { email: true, isActive: true } } },
    })
    if (!row || !row.user.isActive) return { valid: false, reason: 'INVALID' }
    if (row.usedAt) return { valid: false, reason: 'USED' }
    if (row.expiresAt.getTime() <= Date.now()) return { valid: false, reason: 'EXPIRED' }
    return {
      valid: true,
      purpose: row.purpose,
      email: maskEmail(row.user.email),
      expiresAt: row.expiresAt,
    }
  }

  /**
   * Задать пароль по токену. Токен одноразовый: погашается атомарно (двойной
   * клик или гонка не пройдут). После смены пароля гасим остальные ссылки и
   * отзываем все сессии пользователя.
   */
  async consume(token: string, password: string): Promise<{ ok: true }> {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Пароль минимум ${MIN_PASSWORD_LENGTH} символов`)
    }
    const now = new Date()
    const row = await this.prisma.passwordToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { select: { isActive: true } } },
    })
    if (!row || !row.user.isActive || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException(INVALID_LINK)
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (claimed.count !== 1) throw new BadRequestException(INVALID_LINK)

      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } })
      await tx.passwordToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } })
      await tx.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now } })
    })
    return { ok: true }
  }
}
