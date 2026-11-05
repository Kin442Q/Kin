import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Результат отправки. Почта — не критичный путь: сервис никогда не бросает
 * исключений, а возвращает причину, и вызывающий код выбирает запасной путь
 * (например, показать причину и предложить отправить приглашение ещё раз).
 */
export type MailResult =
  | { sent: true; id?: string }
  | {
      sent: false
      /** NOT_CONFIGURED — нет ключа; REJECTED — провайдер ответил ошибкой; NETWORK — не достучались. */
      reason: 'NOT_CONFIGURED' | 'REJECTED' | 'NETWORK'
      /** Сообщение провайдера (без секретов), если оно есть. */
      detail?: string
    }

const DEFAULT_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Мактаби ман <no-reply@tahlilgar.cyou>'
const TIMEOUT_MS = 10_000

/**
 * Отправка писем через HTTP API Resend. SMTP не используем: Railway отключает
 * его на тарифах Free/Trial/Hobby и сам рекомендует почтовые API по HTTPS.
 * Ключ приходит из RESEND_API_KEY; без него отправка отключена.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('mail.resendApiKey')
  }

  async send(msg: MailMessage): Promise<MailResult> {
    const apiKey = this.config.get<string>('mail.resendApiKey')
    if (!apiKey) return { sent: false, reason: 'NOT_CONFIGURED' }

    const url = this.config.get<string>('mail.apiUrl') || DEFAULT_API_URL
    const from = this.config.get<string>('mail.from') || DEFAULT_FROM

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
        signal: controller.signal,
      })
      const body = (await res.json().catch(() => ({}))) as { id?: unknown; message?: unknown }
      if (res.ok) return { sent: true, id: typeof body.id === 'string' ? body.id : undefined }

      const detail = typeof body.message === 'string' ? body.message.slice(0, 300) : undefined
      // В лог — только статус и сообщение провайдера: ни письма, ни ссылок, ни ключа.
      this.logger.warn(`Письмо не отправлено: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
      return { sent: false, reason: 'REJECTED', detail }
    } catch (e) {
      this.logger.warn(`Письмо не отправлено: ${e instanceof Error ? e.name : 'ошибка сети'}`)
      return { sent: false, reason: 'NETWORK' }
    } finally {
      clearTimeout(timer)
    }
  }
}
