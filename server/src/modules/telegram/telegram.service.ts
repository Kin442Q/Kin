import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { QUEUE_TELEGRAM } from '../../infrastructure/bullmq/bull.module'
import dayjs from 'dayjs'

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)

  constructor(
    @InjectQueue(QUEUE_TELEGRAM) private telegramQueue: Queue,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Отправить уведомление об оплате родителю
   */
  async notifyPaymentStatus(
    studentId: string,
    chatId: number,
    paid: boolean,
    amount: number,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { group: true },
    })

    if (!student) return

    const month = dayjs().format('MMMM YYYY')
    const status = paid ? '✅ ОПЛАЧЕНО' : '⏳ ОЖИДАНИЕ ОПЛАТЫ'

    const text = `
📊 <b>Информация об оплате</b>

👶 Ребёнок: <b>${student.firstName} ${student.lastName}</b>
📍 Группа: <b>${student.group?.name}</b>
🗓️ Месяц: <b>${month}</b>

💰 Сумма: <b>${amount} сомони</b>
📌 Статус: ${status}

Спасибо!
    `.trim()

    await this.sendMessage(chatId, text)
  }

  /**
   * Отправить напоминание об оплате
   */
  async sendPaymentReminder(
    studentId: string,
    chatId: number,
    daysLeft: number,
    amount: number,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    })

    if (!student) return

    const text = `
⏰ <b>Напоминание об оплате</b>

👶 <b>${student.firstName}</b>

⚠️ Осталось дней для оплаты: <b>${daysLeft}</b>
💰 Сумма: <b>${amount} сомони</b>

Пожалуйста, оплатите вовремя!
    `.trim()

    await this.sendMessage(chatId, text)
  }

  /**
   * Отправить сообщение в очередь для отправки через Telegram
   */
  private async sendMessage(chatId: number, text: string) {
    await this.telegramQueue.add('send-message', {
      chatId,
      text,
      parse_mode: 'HTML',
    })

    this.logger.log(`[telegram] Уведомление об оплате отправлено в чат ${chatId}`)
  }
}
