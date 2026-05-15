import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { QUEUE_TELEGRAM } from '../../infrastructure/bullmq/bull.module'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { phoneSuffix9 } from './telegram-bot.service'

interface ReminderItem {
  /** Один или несколько телефонов родителей (мама + папа) */
  phones: string[]
  studentName: string
  amount: number
  daysLeft: number
  groupName?: string
  month?: string
}

interface PaymentNotification {
  phones: string[]
  studentName: string
  groupName?: string
  amount: number
  paid: boolean
  month?: string
}

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name)

  constructor(
    @InjectQueue(QUEUE_TELEGRAM) private telegramQueue: Queue,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Найти chat_id по списку телефонов.
   * Матчинг по последним 9 цифрам (национальный номер).
   */
  private async resolveChatIds(phones: string[]): Promise<number[]> {
    const suffixes = phones
      .filter((p) => !!p)
      .map((p) => phoneSuffix9(p))
      .filter((s) => s.length >= 9)

    if (suffixes.length === 0) return []

    const links = await this.prisma.phoneChatLink.findMany({
      where: { phoneNormalized: { in: suffixes } },
      select: { chatId: true },
    })

    return links.map((l) => Number(l.chatId))
  }

  /**
   * Отправить напоминания об оплате нескольким семьям.
   */
  async sendBulkReminders(items: ReminderItem[]) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Список получателей пуст')
    }

    let sent = 0
    let queued = 0
    const skipped: Array<{ studentName: string; reason: string }> = []

    for (const item of items) {
      try {
        const chatIds = await this.resolveChatIds(item.phones || [])

        if (chatIds.length === 0) {
          skipped.push({
            studentName: item.studentName,
            reason: 'Родители не зарегистрированы в боте',
          })
          continue
        }

        for (const chatId of chatIds) {
          try {
            await this.enqueueReminder(chatId, item)
            queued++
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            this.logger.error(
              `[telegram] enqueue failed for ${item.studentName}: ${msg}`,
            )
            skipped.push({
              studentName: item.studentName,
              reason: `Ошибка очереди: ${msg}`,
            })
          }
        }
        sent++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const stack = e instanceof Error ? e.stack : ''
        this.logger.error(
          `[telegram] processing ${item.studentName} failed: ${msg}\n${stack}`,
        )
        skipped.push({
          studentName: item.studentName,
          reason: `Ошибка обработки: ${msg}`,
        })
      }
    }

    this.logger.log(
      `[telegram] Поставлено в очередь ${queued} напоминаний для ${sent} семей`,
    )

    return {
      familiesNotified: sent,
      messagesQueued: queued,
      total: items.length,
      skipped,
    }
  }

  /**
   * Отправить подтверждение оплаты родителям.
   */
  async sendPaymentConfirmation(item: PaymentNotification) {
    const chatIds = await this.resolveChatIds(item.phones || [])

    if (chatIds.length === 0) {
      return {
        success: false,
        reason: 'Родители не зарегистрированы в боте',
      }
    }

    const status = item.paid ? '✅ ОПЛАЧЕНО' : '⏳ ОЖИДАНИЕ ОПЛАТЫ'
    const monthLine = item.month ? `🗓️ Месяц: <b>${item.month}</b>\n` : ''
    const groupLine = item.groupName
      ? `📍 Группа: <b>${item.groupName}</b>\n`
      : ''

    const text = `
📊 <b>Информация об оплате</b>

👶 Ребёнок: <b>${item.studentName}</b>
${groupLine}${monthLine}
💰 Сумма: <b>${item.amount} сомони</b>
📌 Статус: ${status}

Спасибо!
    `.trim()

    for (const chatId of chatIds) {
      await this.enqueueMessage(chatId, text)
    }
    return { success: true, sent: chatIds.length }
  }

  private async enqueueReminder(chatId: number, item: ReminderItem) {
    const monthLine = item.month ? `🗓️ Месяц: <b>${item.month}</b>\n` : ''
    const groupLine = item.groupName
      ? `📍 Группа: <b>${item.groupName}</b>\n`
      : ''

    const text = `
⏰ <b>Напоминание об оплате</b>

👶 <b>${item.studentName}</b>
${groupLine}${monthLine}
⚠️ Осталось дней для оплаты: <b>${item.daysLeft}</b>
💰 Сумма: <b>${item.amount} сомони</b>

Пожалуйста, оплатите вовремя!
    `.trim()

    await this.enqueueMessage(chatId, text)
  }

  private async enqueueMessage(chatId: number, text: string) {
    await this.telegramQueue.add('send-message', {
      chatId,
      text,
      parse_mode: 'HTML',
    })
  }
}
