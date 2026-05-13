import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Role, User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID, createHash } from 'node:crypto'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import type { JwtPayload, RefreshJwtPayload } from '../../common/types/jwt-payload'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

export interface TokenPair {
  accessToken: string
  refreshToken: string
  refreshTokenExpiresAt: Date
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------
  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user || !user.isActive) throw new UnauthorizedException('Неверный email или пароль')

    const ok = await bcrypt.compare(dto.password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Неверный email или пароль')

    const tokens = await this.issueTokens(user, meta)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return tokens
  }

  // -------------------------------------------------------------------
  // Register (только SUPER_ADMIN дёргает)
  // -------------------------------------------------------------------
  async register(actor: { role: Role }, dto: RegisterDto) {
    if (actor.role !== 'SUPER_ADMIN' && dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Нельзя создать SUPER_ADMIN')
    }
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('Email уже занят')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const u = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        groupId: dto.groupId,
      },
    })
    return this.serialize(u)
  }

  // -------------------------------------------------------------------
  // Refresh — ротация
  // -------------------------------------------------------------------
  async refresh(payload: { sub: string; jti: string; raw: string }, meta: { userAgent?: string; ip?: string }) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } })
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Возможная попытка подмены — отзываем все токены пользователя для безопасности.
      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      }
      throw new UnauthorizedException('Refresh-token недействителен')
    }
    const hashOk = stored.tokenHash === this.hashToken(payload.raw)
    if (!hashOk) throw new UnauthorizedException('Refresh-token не совпадает')

    // Помечаем старый отозванным и выдаём новый — rotation pattern.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } })
    return this.issueTokens(user, meta)
  }

  // -------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------
  async logout(userId: string, jti?: string, accessJti?: string) {
    if (jti) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, jti, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
    if (accessJti) {
      // Кладём в blacklist на оставшееся время жизни access-токена.
      await this.redis.set(
        `jwt:blacklist:${accessJti}`,
        true,
        15 * 60, // совпадает с TTL access-token
      )
    }
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async issueTokens(user: User, meta: { userAgent?: string; ip?: string }): Promise<TokenPair & { user: ReturnType<AuthService['serialize']> }> {
    const accessJti = randomUUID()
    const refreshJti = randomUUID()

    const accessPayload: JwtPayload & { jti: string } = {
      sub: user.id,
      email: user.email,
      role: user.role,
      groupId: user.groupId ?? null,
      childId: user.childId ?? null,
      jti: accessJti,
    }
    const refreshPayload: RefreshJwtPayload = { sub: user.id, jti: refreshJti }

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl'),
    })
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshTtl'),
    })

    // Сохраняем хэш refresh в БД для отзыва.
    const refreshTokenExpiresAt = this.parseTtlToDate(this.config.get<string>('jwt.refreshTtl')!)
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti: refreshJti,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: refreshTokenExpiresAt,
      },
    })

    return { user: this.serialize(user), accessToken, refreshToken, refreshTokenExpiresAt }
  }

  private serialize(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      groupId: user.groupId,
      childId: user.childId,
      avatarUrl: user.avatarUrl,
    }
  }

  private hashToken(t: string) {
    return createHash('sha256').update(t).digest('hex')
  }

  private parseTtlToDate(ttl: string): Date {
    // Поддержка форматов вроде "30d", "15m", "12h"
    const m = ttl.match(/^(\d+)([smhd])$/)
    if (!m) return new Date(Date.now() + 30 * 24 * 3600_000)
    const n = parseInt(m[1], 10)
    const mult = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd']
    return new Date(Date.now() + n * mult * 1000)
  }
}
