import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import bcrypt from 'bcryptjs'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { randomPassword } from '../../common/random-password'
import { MailService, type MailResult } from '../mail/mail.service'
import { inviteEmail, resetEmail } from '../mail/mail-templates'
import { PasswordTokensService, isRealEmail } from '../password-tokens/password-tokens.service'

/** Почему письмо не ушло: почта не настроена, провайдер отклонил, нет связи. */
export type MailFailure = Extract<MailResult, { sent: false }>['reason']

/**
 * Чем закончилась выдача доступа новому человеку. Пароля не знает никто, кроме самого человека:
 * он задаёт его по ссылке из письма. Если письмо не ушло, аккаунт остаётся, а админ может
 * отправить приглашение ещё раз — пароль он не получает и не вводит.
 */
export type AccessGrant =
  | { sent: true; email: string }
  | { sent: false; email: string; reason: MailFailure; detail?: string }

interface Account {
  id: string
  email: string
  fullName: string
}

/**
 * Админ пароли не вводит. Старый клиент, который всё ещё присылает пароль, получает
 * понятный отказ, а не молчаливое «принято»: иначе админ решит, что задал пароль.
 */
export function assertNoPassword(dto: object | null | undefined): void {
  if (dto && 'password' in dto && (dto as { password?: unknown }).password !== undefined) {
    throw new BadRequestException(
      'Пароль не задаётся: человек придумает его сам по ссылке из письма. Обновите страницу.',
    )
  }
}

/**
 * Доступ выдаётся только письмом, поэтому почта обязательна. Возвращает адрес в нижнем регистре.
 */
export function requireInviteEmail(email: string | null | undefined): string {
  const clean = String(email ?? '').trim()
  if (!isRealEmail(clean)) {
    throw new BadRequestException(
      'Укажите email: на него придёт приглашение со ссылкой, по которой человек сам задаст пароль.',
    )
  }
  return clean.toLowerCase()
}

/** Роли, которым админ школы может отправить ссылку для смены пароля. Директору и владельцу — нет. */
const RESETTABLE_ROLES = ['TEACHER', 'ADMIN', 'PARENT']

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly passwordTokens: PasswordTokensService,
  ) {}

  /**
   * Пароль нового аккаунта до того, как человек задаст свой: случайный, его никто не знает
   * и не увидит; в базу идёт только хеш. Войти с ним нельзя, потому что он нигде не показывается.
   */
  async newSecret(): Promise<{ hash: string }> {
    return { hash: await bcrypt.hash(randomPassword(), 10) }
  }

  /**
   * Отправить человеку письмо с одноразовой ссылкой, по которой он задаёт пароль.
   * Письмо не критичный путь: не ушло — аккаунт остаётся, а админ видит причину и может повторить.
   */
  async deliver(account: Account, purpose: 'INVITE' | 'RESET' = 'INVITE'): Promise<AccessGrant> {
    let sent: MailResult
    try {
      const { link, hours } = await this.passwordTokens.issue(account.id, purpose)
      const template = purpose === 'INVITE' ? inviteEmail : resetEmail
      sent = await this.mail.send({
        to: account.email,
        ...template({ name: account.fullName, link, hours }),
      })
    } catch {
      // сбой базы при выдаче ссылки не должен ронять уже созданный аккаунт
      sent = { sent: false, reason: 'NETWORK' }
    }
    if (sent.sent) return { sent: true, email: account.email }
    return { sent: false, email: account.email, reason: sent.reason, detail: sent.detail }
  }

  /**
   * Отправить человеку из своей школы письмо со ссылкой для смены (или первого задания) пароля.
   * Пароль никому не показывается; старые сессии закрываются, когда человек зададит новый.
   */
  async sendLink(actor: AuthUser, userId: string): Promise<AccessGrant> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!target) throw new NotFoundException('Пользователь не найден')
    if (!actor.kindergartenId || target.kindergartenId !== actor.kindergartenId) {
      throw new ForbiddenException('Пользователь из другой школы')
    }
    if (target.id === actor.sub) {
      throw new BadRequestException('Свой пароль меняйте в настройках')
    }
    if (!RESETTABLE_ROLES.includes(target.role)) {
      throw new BadRequestException('Для этой роли ссылка не отправляется')
    }
    if (!isRealEmail(target.email)) {
      throw new BadRequestException('У этого человека не указан email — сначала добавьте почту в его карточке')
    }
    // Тот, кто ни разу не входил, получает приглашение; остальные — ссылку для смены пароля.
    return this.deliver(target, target.lastLoginAt ? 'RESET' : 'INVITE')
  }
}
