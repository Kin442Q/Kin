import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'

export interface PushPayload {
  to: string
  title: string
  body: string
  /** Произвольные данные, попадают в notification.request.content.data в мобайле */
  data?: Record<string, unknown>
  /** Звук, по умолчанию default */
  sound?: 'default' | null
}

/** Что не получилось отправить: нужно для диагностики («тестовое уведомление») и логов. */
export interface PushFailure {
  token: string
  /** Код Expo: DeviceNotRegistered, InvalidCredentials, MessageTooBig, … */
  error: string
  message: string
}

export interface PushResult {
  /** Сколько сообщений Expo принял в работу (дальше их доставляет Google / Apple). */
  accepted: number
  failures: PushFailure[]
}

/** Канал Android, который приложение создаёт при запуске (mobile/src/lib/push.ts). */
export const ANDROID_CHANNEL_ID = 'default'

const isExpoToken = (t: string) =>
  t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')

interface Recipient {
  id: string
  expoPushToken: string | null
}

/**
 * Рассылка уведомлений: запись в раздел «Оповещения» (колокольчик в приложении) плюс push через Expo Push API
 * (https://docs.expo.dev/push-notifications/sending-notifications/).
 *
 * - Запись в «Оповещения» создаётся ВСЕГДА (даже без push-токена), поэтому список работает и тогда,
 *   когда телефон push ещё не принимает.
 * - Не падает при ошибках сети — логирует и продолжает.
 * - Массовая отправка: батчи по 100 (лимит Expo). Пустые и «не Expo» токены игнорируются.
 * - Ответ Expo разбирается по каждому сообщению: токен мёртвого устройства (DeviceNotRegistered) снимается,
 *   остальные ошибки (например нет ключа FCM — InvalidCredentials) попадают в лог, а не пропадают молча.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)
  private readonly endpoint =
    process.env.EXPO_PUSH_ENDPOINT ?? 'https://exp.host/--/api/v2/push/send'
  /** Дополнительный токен (если включён в Expo «push security») */
  private readonly accessToken = process.env.EXPO_ACCESS_TOKEN

  constructor(private readonly prisma: PrismaService) {}

  /** Уведомить одного пользователя по id. */
  async sendToUser(userId: string, payload: Omit<PushPayload, 'to'>) {
    await this.sendToUsers([userId], payload)
  }

  /** Уведомить нескольких пользователей сразу. */
  async sendToUsers(userIds: string[], payload: Omit<PushPayload, 'to'>) {
    if (!userIds.length) return
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, expoPushToken: true },
    })
    await this.deliver(users, payload)
  }

  /** Уведомить родителей заданной группы. Учитель и админы не получают. */
  async sendToGroupParents(
    groupId: string,
    payload: Omit<PushPayload, 'to'>,
  ): Promise<void> {
    // Парент-аккаунты, у которых childId — ребёнок этой группы, или
    // которые M:N привязаны как parents к ребёнку этой группы.
    const students = await this.prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      select: {
        parents: {
          where: { isActive: true },
          select: { id: true, expoPushToken: true },
        },
      },
    })
    // Плюс родители через legacy childId
    const legacyParents = await this.prisma.user.findMany({
      where: { role: 'PARENT', isActive: true, child: { groupId } },
      select: { id: true, expoPushToken: true },
    })
    await this.deliver(
      [...students.flatMap((s) => s.parents), ...legacyParents],
      payload,
    )
  }

  /** Уведомить родителей конкретного ученика. */
  async sendToStudentParents(
    studentId: string,
    payload: Omit<PushPayload, 'to'>,
  ): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        parents: {
          where: { isActive: true },
          select: { id: true, expoPushToken: true },
        },
      },
    })
    const legacy = await this.prisma.user.findMany({
      where: { role: 'PARENT', isActive: true, childId: studentId },
      select: { id: true, expoPushToken: true },
    })
    await this.deliver([...(student?.parents ?? []), ...legacy], payload)
  }

  /**
   * Тестовое push-уведомление самому себе (экран «Уведомления» в приложении): без записи в список,
   * с подробным результатом — так видно, дошёл ли push до Expo и почему нет.
   */
  async sendTest(userId: string): Promise<{
    registered: boolean
    result: PushResult | null
  }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    })
    if (!u?.expoPushToken) return { registered: false, result: null }
    const result = await this.send([
      {
        to: u.expoPushToken,
        title: 'Тест уведомлений',
        body: 'Если вы это видите, push-уведомления работают.',
        data: { kind: 'test' },
      },
    ])
    return { registered: true, result }
  }

  /** Запись в «Оповещения» + push тем, у кого есть токен. */
  private async deliver(
    recipients: Recipient[],
    payload: Omit<PushPayload, 'to'>,
  ): Promise<void> {
    const byId = new Map<string, Recipient>()
    for (const r of recipients) byId.set(r.id, r)
    if (!byId.size) return

    await this.record([...byId.keys()], payload).catch((e) =>
      this.logger.warn(`Не удалось записать оповещения: ${(e as Error).message}`),
    )

    // Один токен — одно сообщение, даже если им пользуются два аккаунта.
    const tokens = new Set<string>()
    for (const r of byId.values()) if (r.expoPushToken) tokens.add(r.expoPushToken)
    if (!tokens.size) return
    await this.send([...tokens].map((to) => ({ ...payload, to })))
  }

  /** Запись в раздел «Оповещения»: колокольчик в приложении читает `GET /notifications`. */
  private async record(
    userIds: string[],
    payload: Omit<PushPayload, 'to'>,
  ): Promise<void> {
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: payload.title,
        description: payload.body,
        type: 'INFO' as const,
        channel: 'IN_APP' as const,
        payload: (payload.data ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    })
  }

  /** Низкоуровневая отправка пачкой. Не пробрасывает ошибки наверх. */
  async send(messages: PushPayload[]): Promise<PushResult> {
    const result: PushResult = { accepted: 0, failures: [] }
    // Фильтруем «не Expo» токены — на всякий случай.
    const valid = messages.filter((m) => m.to && isExpoToken(m.to))
    if (!valid.length) return result

    // Бьём на батчи по 100.
    for (let i = 0; i < valid.length; i += 100) {
      const batch = valid.slice(i, i + 100).map((m) => ({
        ...m,
        sound: m.sound ?? 'default',
        // Без channelId Android кладёт уведомление в «служебный» канал без всплывающего баннера
        channelId: ANDROID_CHANNEL_ID,
        // high — чтобы уведомление пробивало режим экономии у спящего телефона
        priority: 'high' as const,
      }))
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            ...(this.accessToken
              ? { Authorization: `Bearer ${this.accessToken}` }
              : {}),
          },
          body: JSON.stringify(batch),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          this.logger.warn(
            `Expo push HTTP ${res.status}: ${text.slice(0, 200)}`,
          )
          result.failures.push(
            ...batch.map((m) => ({
              token: m.to,
              error: `HTTP_${res.status}`,
              message: text.slice(0, 200),
            })),
          )
          continue
        }
        // Expo отвечает 200, даже если сообщение не принято: итог по каждому — в массиве tickets.
        const json = (await res.json().catch(() => null)) as {
          data?: Array<{
            status?: string
            message?: string
            details?: { error?: string }
          }>
        } | null
        const tickets = Array.isArray(json?.data) ? json.data : []
        await this.handleTickets(batch, tickets, result)
      } catch (e) {
        this.logger.warn(`Expo push failed: ${(e as Error).message}`)
        result.failures.push(
          ...batch.map((m) => ({
            token: m.to,
            error: 'NETWORK',
            message: (e as Error).message,
          })),
        )
      }
    }
    return result
  }

  private async handleTickets(
    batch: PushPayload[],
    tickets: Array<{ status?: string; message?: string; details?: { error?: string } }>,
    result: PushResult,
  ): Promise<void> {
    for (let idx = 0; idx < batch.length; idx++) {
      const ticket = tickets[idx]
      const token = batch[idx].to
      if (!ticket || ticket.status === 'ok') {
        if (ticket) result.accepted += 1
        continue
      }
      const error = ticket.details?.error ?? 'UNKNOWN'
      const message = ticket.message ?? ''
      result.failures.push({ token, error, message })
      if (error === 'DeviceNotRegistered') {
        // Приложение удалено или токен устарел — больше не шлём на него.
        await this.prisma.user
          .updateMany({ where: { expoPushToken: token }, data: { expoPushToken: null } })
          .catch(() => undefined)
        this.logger.warn(`Expo push: устройство не зарегистрировано, токен снят`)
      } else if (error === 'InvalidCredentials') {
        this.logger.error(
          `Expo push: у Expo нет ключа FCM/APNs этого приложения (${message}). ` +
            `Android: загрузить ключ сервисного аккаунта FCM в EAS (eas credentials) и пересобрать приложение с google-services.json.`,
        )
      } else {
        this.logger.warn(`Expo push ${error}: ${message.slice(0, 200)}`)
      }
    }
  }
}
