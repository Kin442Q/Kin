import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'

/**
 * Нормализует номер телефона: оставляет только цифры.
 * Для матчинга используем последние 9 цифр (национальный номер).
 *
 * Примеры:
 *   "+992 (90) 123-45-67"  → "992901234567"  (full)
 *   suffix9                → "901234567"
 *
 * Это позволяет сопоставлять номера, даже если они записаны
 * в разных форматах в системе и в Telegram.
 */
export function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '')
}

export function phoneSuffix9(raw: string): string {
  const norm = normalizePhone(raw)
  return norm.slice(-9)
}

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
    }
    chat: { id: number; type: string }
    date: number
    text?: string
    contact?: {
      phone_number: string
      first_name?: string
      last_name?: string
      user_id?: number
    }
  }
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name)
  private offset = 0
  private polling = false
  private pollAbort: AbortController | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const token = this.getToken()
    if (!token) {
      this.logger.warn(
        '[bot] TELEGRAM_BOT_TOKEN не задан — long polling не запущен',
      )
      return
    }
    this.polling = true
    this.startPolling().catch((e) => {
      this.logger.error(`[bot] polling crashed: ${e?.message || e}`)
    })
    this.logger.log('[bot] long polling запущен')
  }

  async onModuleDestroy() {
    this.polling = false
    this.pollAbort?.abort()
  }

  private getToken(): string | undefined {
    return (
      this.config.get<string>('telegram.botToken') ||
      process.env.TELEGRAM_BOT_TOKEN
    )
  }

  private async startPolling() {
    while (this.polling) {
      try {
        const updates = await this.getUpdates()
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1)
          await this.handleUpdate(update).catch((e) =>
            this.logger.error(`[bot] handleUpdate: ${e?.message || e}`),
          )
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          this.logger.error(`[bot] getUpdates: ${e?.message || e}`)
          await new Promise((r) => setTimeout(r, 3000))
        }
      }
    }
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    const token = this.getToken()
    if (!token) return []

    this.pollAbort = new AbortController()
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.offset}&timeout=25`

    const res = await fetch(url, { signal: this.pollAbort.signal })
    if (!res.ok) {
      throw new Error(`getUpdates HTTP ${res.status}`)
    }
    const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] }
    return data.ok ? data.result : []
  }

  private async handleUpdate(update: TelegramUpdate) {
    const msg = update.message
    if (!msg) return

    const chatId = msg.chat.id

    // Родитель поделился контактом
    if (msg.contact) {
      await this.handleContact(chatId, msg.contact, msg.from)
      return
    }

    // /start
    if (msg.text === '/start' || msg.text === '/start@') {
      await this.sendWelcome(chatId)
      return
    }

    // Любой другой текст
    if (msg.text) {
      await this.sendMessage(
        chatId,
        '👋 Чтобы получать уведомления об оплате, нажмите /start и поделитесь номером телефона.',
      )
    }
  }

  private async handleContact(
    chatId: number,
    contact: NonNullable<TelegramUpdate['message']>['contact'],
    from?: NonNullable<TelegramUpdate['message']>['from'],
  ) {
    if (!contact) return

    const phoneNorm = normalizePhone(contact.phone_number)
    const phone9 = phoneSuffix9(phoneNorm)

    if (!phone9) {
      await this.sendMessage(chatId, '❌ Не удалось распознать номер телефона.')
      return
    }

    const fullName = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(' ')
      .trim()

    try {
      await this.prisma.phoneChatLink.upsert({
        where: { phoneNormalized: phone9 },
        update: {
          chatId: BigInt(chatId),
          fullName: fullName || undefined,
          username: from?.username || undefined,
        },
        create: {
          phoneNormalized: phone9,
          chatId: BigInt(chatId),
          fullName: fullName || undefined,
          username: from?.username || undefined,
        },
      })

      this.logger.log(
        `[bot] Привязан номер +${phoneNorm} → chatId ${chatId} (${fullName})`,
      )

      await this.sendMessage(
        chatId,
        `✅ <b>Спасибо!</b>\n\nВаш номер привязан. Теперь вы будете получать уведомления об оплате за ребёнка.\n\n📞 Номер: <code>+${phoneNorm}</code>`,
      )
    } catch (e: any) {
      this.logger.error(`[bot] phoneChatLink upsert: ${e?.message || e}`)
      await this.sendMessage(
        chatId,
        '❌ Произошла ошибка при сохранении номера. Попробуйте позже.',
      )
    }
  }

  private async sendWelcome(chatId: number) {
    const token = this.getToken()
    if (!token) return

    const url = `https://api.telegram.org/bot${token}/sendMessage`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: 'HTML',
        text:
          '👋 <b>Добро пожаловать!</b>\n\n' +
          'Это бот детского сада для уведомлений об оплате.\n\n' +
          '📱 Нажмите кнопку ниже, чтобы поделиться номером телефона. ' +
          'Этот номер должен совпадать с тем, что записан в системе.',
        reply_markup: {
          keyboard: [
            [
              {
                text: '📱 Поделиться номером телефона',
                request_contact: true,
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    })
  }

  private async sendMessage(chatId: number, text: string) {
    const token = this.getToken()
    if (!token) return

    const url = `https://api.telegram.org/bot${token}/sendMessage`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
  }
}
