import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import {
  QUEUE_TELEGRAM,
  QUEUE_PAYMENT_REMINDER,
} from '../../infrastructure/bullmq/bull.module'

/**
 * Сервис уведомлений. Принимает события домена и:
 *   - сохраняет in-app notification в БД (для шапки приложения),
 *   - кладёт задачу в нужную очередь (Telegram/email/SMS),
 *   - все каналы — fire-and-forget, по идемпотентному jobId.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_TELEGRAM) private readonly telegramQ: Queue,
    @InjectQueue(QUEUE_PAYMENT_REMINDER) private readonly paymentQ: Queue,
  ) {}

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { OR: [{ userId }, { userId: null }], read: false },
      data: { read: true },
    })
  }

  /**
   * Отправить персональное уведомление пользователю.
   * channel=TELEGRAM → пушится в очередь, отправляется воркером.
   */
  async send(userId: string, msg: { title: string; description?: string; channel?: 'IN_APP' | 'TELEGRAM' }) {
    const channel = msg.channel ?? 'IN_APP'
    const n = await this.prisma.notification.create({
      data: { userId, title: msg.title, description: msg.description, channel, type: 'INFO' },
    })
    if (channel === 'TELEGRAM') {
      await this.telegramQ.add(
        'send',
        { userId, title: msg.title, description: msg.description },
        { jobId: `tg:${userId}:${n.id}` },
      )
    }
    return n
  }

  /** Ставим задачу на массовый ремайндер должников за месяц. */
  async enqueuePaymentReminders(month: string) {
    return this.paymentQ.add(
      'remind-debtors',
      { month },
      { jobId: `payment-reminder:${month}` },
    )
  }
}
