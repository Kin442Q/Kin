import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
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
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { NotificationsService } from '../notifications/notifications.service'
import { FeaturesService } from '../features/features.service'
import type { FeatureKey } from '../features/feature-registry'
import { MailService } from '../mail/mail.service'
import { resetEmail } from '../mail/mail-templates'
import { PasswordTokensService, isRealEmail } from '../password-tokens/password-tokens.service'
import { StudentLinkService } from '../student-links/student-link.service'

const STUDENT_USE_LINK = 'Ученики входят по логину и паролю или по личной ссылке от классного руководителя'
const STUDENT_NO_PASSWORD =
  'Пароль ещё не выдан. Войдите по личной ссылке или попросите классного руководителя выдать логин и пароль'
const STUDENT_LOGIN_DOMAIN = 'students.local'
/** Пароль ученика короткий, поэтому подбор ограничен: 10 неверных попыток за 15 минут закрывают вход. */
const STUDENT_MAX_FAILS = 10
const STUDENT_FAIL_TTL_SEC = 15 * 60
const LINK_DEAD = 'Ссылка не работает. Попросите классного руководителя выдать новую.'

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
    private readonly notifications: NotificationsService,
    private readonly features: FeaturesService,
    private readonly mail: MailService,
    private readonly passwordTokens: PasswordTokensService,
    private readonly studentLinks: StudentLinkService,
  ) {}

  // -------------------------------------------------------------------
  // Login — поддерживает вход по email ИЛИ по телефону
  // -------------------------------------------------------------------
  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    if (!dto.email && !dto.phone && !dto.login) {
      throw new UnauthorizedException('Введите email, телефон или логин')
    }

    // Логин ученика («st4k9x2m»): служебный адрес в домене students.local
    if (!dto.email && !dto.phone && dto.login) {
      const raw = dto.login.toLowerCase().trim()
      return this.loginStudentWithPassword(raw.includes('@') ? raw : `${raw}@${STUDENT_LOGIN_DOMAIN}`, dto.password, meta)
    }

    let user: User
    if (dto.email) {
      const found = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase().trim() },
      })
      if (!found || !found.isActive) {
        throw new UnauthorizedException('Неверный логин или пароль')
      }
      // Ученик: вход по выданным логину и паролю (с лимитом попыток и проверкой кабинета)
      if (found.role === 'STUDENT') return this.loginStudentWithPassword(found.email, dto.password, meta)
      const ok = await bcrypt.compare(dto.password, found.passwordHash)
      if (!ok) throw new UnauthorizedException('Неверный логин или пароль')
      user = found
    } else {
      // Телефон не уникален между школами (у User нет unique на phone), поэтому
      // берём всех активных с этим номером и выбираем того, чей пароль подошёл.
      const candidates = await this.prisma.user.findMany({
        where: { phone: dto.phone!.trim(), isActive: true },
      })
      const matched: User[] = []
      for (const c of candidates) {
        if (await bcrypt.compare(dto.password, c.passwordHash)) matched.push(c)
      }
      if (matched.length === 0) {
        throw new UnauthorizedException('Неверный логин или пароль')
      }
      if (matched.length > 1) {
        throw new UnauthorizedException(
          'Этот номер привязан к нескольким аккаунтам — войдите по email',
        )
      }
      user = matched[0]
    }

    // По номеру телефона ученик не входит: у учеников есть только выданный логин.
    if (user.role === 'STUDENT') throw new UnauthorizedException(STUDENT_USE_LINK)

    const tokens = await this.issueTokens(user, meta)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return tokens
  }

  // -------------------------------------------------------------------
  // Вход ученика по личной ссылке (вместо логина и пароля)
  // -------------------------------------------------------------------
  async loginWithStudentLink(token: string, meta: { userAgent?: string; ip?: string }) {
    const dead = () => new UnauthorizedException(LINK_DEAD)

    const parsed = this.studentLinks.parse(token)
    if (!parsed) throw dead()

    const user = await this.prisma.user.findUnique({ where: { id: parsed.userId } })
    // Одинаковый отказ для «нет такого», «не ученик», «отключён», «ссылка отозвана» и
    // «подпись не та»: ничего лишнего не раскрываем.
    if (!user || user.role !== 'STUDENT' || !user.isActive || user.linkVersion == null) throw dead()
    if (!this.studentLinks.verify(token, user.linkVersion)) throw dead()

    await this.assertStudentMayEnter(user, dead)

    const tokens = await this.issueTokens(user, meta)
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    return tokens
  }

  /** Ученик ушёл из школы (архив) или кабинет учеников выключен для школы — вход закрыт. */
  private async assertStudentMayEnter(user: User, refuse: () => Error) {
    if (user.studentId) {
      const student = await this.prisma.student.findUnique({
        where: { id: user.studentId },
        select: { status: true },
      })
      if (!student || student.status !== 'ACTIVE') throw refuse()
    }
    if (!(await this.features.isEnabled(user.kindergartenId, 'portal'))) {
      throw new UnauthorizedException('Кабинет ученика отключён для вашей школы')
    }
  }

  // -------------------------------------------------------------------
  // Вход ученика по логину и паролю, которые выдал классный руководитель
  // -------------------------------------------------------------------
  private async loginStudentWithPassword(email: string, password: string, meta: { userAgent?: string; ip?: string }) {
    const bad = () => new UnauthorizedException('Неверный логин или пароль')
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || user.role !== 'STUDENT' || !user.isActive) throw bad()
    if (!user.passwordIssuedAt) throw new UnauthorizedException(STUDENT_NO_PASSWORD)

    const failKey = `student-login-fails:${user.id}`
    const fails = (await this.redis.get<number>(failKey)) ?? 0
    if (fails >= STUDENT_MAX_FAILS) {
      throw new UnauthorizedException(
        'Слишком много неверных попыток. Подождите 15 минут или попросите классного руководителя выдать новый пароль',
      )
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await this.redis.set(failKey, fails + 1, STUDENT_FAIL_TTL_SEC)
      throw bad()
    }
    await this.redis.del(failKey)

    await this.assertStudentMayEnter(user, bad)

    const tokens = await this.issueTokens(user, meta)
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    return tokens
  }

  // -------------------------------------------------------------------
  // Demo login — публичный вход в «живое демо» (read-only)
  // -------------------------------------------------------------------
  async demoLogin(meta: { userAgent?: string; ip?: string }) {
    const kg = await this.prisma.kindergarten.findFirst({
      where: { isDemo: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!kg) {
      throw new NotFoundException('Демо-учреждение не настроено')
    }
    // Предпочитаем демо-админа, иначе учителя, иначе любого активного.
    const user =
      (await this.prisma.user.findFirst({
        where: { kindergartenId: kg.id, isActive: true, role: 'ADMIN' },
      })) ??
      (await this.prisma.user.findFirst({
        where: { kindergartenId: kg.id, isActive: true, role: 'TEACHER' },
      })) ??
      (await this.prisma.user.findFirst({
        where: { kindergartenId: kg.id, isActive: true },
      }))
    if (!user) {
      throw new NotFoundException('В демо-учреждении нет пользователя')
    }
    return this.issueTokens(user, meta)
  }

  // -------------------------------------------------------------------
  // Forgot password — восстановление доступа.
  // Если у пользователя настоящий email и почта настроена — шлём ему письмо
  // со ссылкой на смену пароля. Иначе (нет email, ученик, почта выключена или
  // письмо не ушло) — запасной путь: уведомление администратору, он отправляет
  // человеку ссылку из карточки пользователя (пароль админ не видит и не задаёт). Ответ всегда одинаковый — не раскрываем,
  // есть ли аккаунт и что именно сработало.
  // -------------------------------------------------------------------
  async requestPasswordReset(dto: ForgotPasswordDto) {
    const generic = {
      ok: true,
      message:
        'Если аккаунт найден, на его email отправлена ссылка для смены пароля. Если email не указан, запрос получит администратор.',
    }
    try {
      const email = dto.email?.toLowerCase().trim()
      const phone = dto.phone?.trim()
      if (!email && !phone) return generic

      const user = email
        ? await this.prisma.user.findUnique({ where: { email } })
        : await this.prisma.user.findFirst({ where: { phone } })
      if (!user || !user.isActive) return generic

      if (isRealEmail(user.email) && this.mail.isConfigured()) {
        try {
          // Не чаще раза в минуту на пользователя: нельзя заспамить чужую почту.
          if (await this.passwordTokens.hasRecent(user.id, 'RESET')) return generic
          const { link, hours } = await this.passwordTokens.issue(user.id, 'RESET')
          const sent = await this.mail.send({
            to: user.email,
            ...resetEmail({ name: user.fullName, link, hours }),
          })
          if (sent.sent) return generic
        } catch {
          // сбой базы при выдаче ссылки — не повод оставить человека без помощи
        }
        // письмо не ушло — продолжаем запасным путём (уведомление админам)
      }

      // Кому слать: админам того же учреждения (+ супер-админам); если у
      // пользователя нет учреждения — всем супер-админам.
      const where = user.kindergartenId
        ? {
            isActive: true,
            id: { not: user.id },
            OR: [
              {
                kindergartenId: user.kindergartenId,
                role: { in: ['ADMIN', 'SUPER_ADMIN'] as Role[] },
              },
              { role: 'SUPER_ADMIN' as Role, kindergartenId: null },
            ],
          }
        : { isActive: true, id: { not: user.id }, role: 'SUPER_ADMIN' as Role }

      const admins = await this.prisma.user.findMany({
        where,
        select: { id: true },
      })

      const contact = user.email ?? user.phone ?? '—'
      await Promise.all(
        admins.map((a) =>
          this.notifications.send(a.id, {
            title: 'Запрос на сброс пароля',
            description: `${user.fullName} (${contact}) запросил восстановление доступа. Отправьте ему ссылку для пароля в карточке пользователя: пароль вы не видите, человек задаёт его сам.`,
            channel: 'IN_APP',
          }),
        ),
      )
    } catch {
      // Восстановление доступа не должно падать наружу — отдаём generic.
    }
    return generic
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

  // -------------------------------------------------------------------
  // Смена своего пароля (все роли, кроме учеников: у них пароля нет)
  // -------------------------------------------------------------------
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
    meta: { userAgent?: string; ip?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.isActive) throw new UnauthorizedException('Пользователь не найден')
    if (user.role === 'STUDENT') {
      throw new BadRequestException('У учеников нет пароля: они входят по личной ссылке')
    }
    // Неверный текущий пароль — 400, а не 401: иначе клиент решит, что сессия умерла, и выбросит из системы.
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Текущий пароль неверный')
    }
    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('Пароль минимум 8 символов')
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('Новый пароль должен отличаться от текущего')
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
    // Остальные устройства выходят; это остаётся в системе с новой сессией.
    return this.issueTokens({ ...user, passwordHash, mustChangePassword: false }, meta)
  }

  // -------------------------------------------------------------------
  // Смена своего email (он же логин). Нужен текущий пароль.
  // -------------------------------------------------------------------
  async changeEmail(
    userId: string,
    dto: { currentPassword: string; newEmail: string },
    meta: { userAgent?: string; ip?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.isActive) throw new UnauthorizedException('Пользователь не найден')
    if (user.role === 'STUDENT') {
      throw new BadRequestException('У учеников нет логина: они входят по личной ссылке')
    }
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Текущий пароль неверный')
    }
    const email = (dto.newEmail ?? '').trim().toLowerCase()
    if (!isRealEmail(email)) throw new BadRequestException('Укажите настоящий email')
    if (email === user.email) throw new BadRequestException('Это уже ваш email')
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Этот email уже занят')
    }

    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { email } })
    // В токене лежит email — выдаём новый, чтобы он не отставал от аккаунта.
    return this.issueTokens(updated, meta)
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async issueTokens(
    user: User,
    meta: { userAgent?: string; ip?: string },
  ): Promise<
    TokenPair & { user: ReturnType<AuthService['serialize']> & { features: FeatureKey[] } }
  > {
    const accessJti = randomUUID()
    const refreshJti = randomUUID()

    // Флаг демо-учреждения кладём в токен — чтобы read-only guard не ходил
    // в БД на каждый запрос.
    let isDemo = false
    if (user.kindergartenId) {
      const kg = await this.prisma.kindergarten.findUnique({
        where: { id: user.kindergartenId },
        select: { isDemo: true },
      })
      isDemo = kg?.isDemo ?? false
    }

    const accessPayload: JwtPayload & { jti: string } = {
      sub: user.id,
      email: user.email,
      role: user.role,
      kindergartenId: user.kindergartenId ?? null,
      groupId: user.groupId ?? null,
      childId: user.childId ?? null,
      studentId: user.studentId ?? null,
      isDemo,
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

    // Включённые разделы учреждения — фронт и мобилка строят меню по ним.
    // Наблюдателю школьные разделы не открываются вовсе (у него нет школы, enabledKeys(null) вернул бы все).
    const features = user.role === 'VIEWER' ? [] : await this.features.enabledKeys(user.kindergartenId)

    return {
      user: { ...this.serialize(user), features },
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    }
  }

  private serialize(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      kindergartenId: user.kindergartenId,
      groupId: user.groupId,
      childId: user.childId,
      studentId: user.studentId,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      /** true — пароль нужно сменить сразу (остаток прежних временных паролей; новых система не выдаёт). */
      mustChangePassword: user.mustChangePassword,
    }
  }

  /**
   * Возвращает данные о текущем пользователе + типе его учреждения.
   * Используется мобилкой / вебом сразу после логина или при гидратации.
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kindergarten: {
          select: {
            id: true,
            name: true,
            type: true,
            isDemo: true,
            latitude: true,
            longitude: true,
            checkInRadiusMeters: true,
          },
        },
        // Классы, где пользователь — классный руководитель (меню «Мой класс»).
        homeroomGroups: { select: { id: true, name: true } },
        // Наблюдатель: чья это учётная запись (шапка кабинета министерства).
        viewerScope: { select: { organization: true, allSchools: true } },
      },
    })
    if (!user) throw new UnauthorizedException('Пользователь не найден')
    return {
      ...this.serialize(user),
      institution: user.kindergarten ?? null,
      homeroomGroups: user.homeroomGroups,
      viewer: user.viewerScope ?? null,
      features: user.role === 'VIEWER' ? [] : await this.features.enabledKeys(user.kindergartenId),
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
