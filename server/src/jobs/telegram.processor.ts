import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job } from 'bullmq'
import { QUEUE_TELEGRAM } from '../infrastructure/bullmq/bull.module'

/**
 * Telegram-воркер. Слушает очередь `telegram` и шлёт сообщения через
 * Bot API. В демо без токена просто логируем — это позволяет крутить
 * систему локально без реальной отправки.
 *
 * Job payload:
 *   { userId: string; title: string; description?: string }
 * либо более общий:
 *   { chatId: string; text: string }
 */
@Processor(QUEUE_TELEGRAM)
export class TelegramProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramProcessor.name)

  constructor(private readonly config: ConfigService) {
    super()
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const botToken = this.config.get<string>('telegram.botToken')
    const chatId = job.data.chatId ?? this.config.get<string>('telegram.chatId')
    const text = job.data.text ?? `${job.data.title}\n${job.data.description ?? ''}`

    if (!botToken || !chatId) {
      this.logger.warn(`[no-creds] would send: ${text}`)
      return
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Telegram failed: ${res.status} ${err}`)
    }
  }
}
