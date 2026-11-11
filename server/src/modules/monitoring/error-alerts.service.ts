import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { MailService } from '../mail/mail.service'
import { AlertEvent, AlertSink, describeError } from './alert-event'
import { buildAlertMail } from './alert-mail'
import { currentCommit } from './build-info'

/** Одну и ту же ошибку в одном месте не повторяем чаще, чем раз в 15 минут. */
export const DEDUPE_MS = 15 * 60_000
/** Жёсткий потолок писем-оповещений в час на весь сервер: если что-то сломалось массово, почта не завалится. */
export const MAX_ALERTS_PER_HOUR = 10
const HOUR_MS = 60 * 60_000

export interface AlertTestResult {
  ok: boolean
  /** Когда не ok: NO_RECIPIENTS — не задан ALERT_EMAIL; MAIL_* — почта не настроена или провайдер отказал. */
  reason?: 'NO_RECIPIENTS' | 'MAIL_NOT_CONFIGURED' | 'MAIL_REJECTED' | 'MAIL_NETWORK'
  recipients: number
  /** Сообщение провайдера почты (без секретов), если есть. */
  detail?: string
}

/**
 * Письма владельцу об ошибках сервера. Адреса — `ALERT_EMAIL` (через запятую); без него оповещения выключены,
 * остаётся обычный лог. Сервис никогда не бросает исключений и не задерживает ответ пользователю: письмо уходит
 * в фоне. Повторы той же ошибки не шлются (счётчик придёт в следующем письме), всего не больше
 * MAX_ALERTS_PER_HOUR писем в час.
 */
@Injectable()
export class ErrorAlertsService implements AlertSink {
  private readonly logger = new Logger(ErrorAlertsService.name)
  private readonly lastSent = new Map<string, { at: number; suppressed: number }>()
  private sentAt: number[] = []
  private skippedByCap = 0
  private readonly pending = new Set<Promise<unknown>>()

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /** Включены ли оповещения (задан хотя бы один корректный адрес). */
  recipients(): string[] {
    const raw = this.config.get<string[]>('alerts.emails') ?? []
    return raw.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  }

  report(event: AlertEvent): void {
    try {
      const to = this.recipients()
      if (!to.length) return

      const err = describeError(event.error)
      const key = [event.source, event.method, event.route, event.status, err.name, err.stack[0] ?? err.message.slice(0, 80)].join('|')
      const now = Date.now()

      const prev = this.lastSent.get(key)
      if (prev && now - prev.at < DEDUPE_MS) {
        prev.suppressed += 1
        return
      }

      this.sentAt = this.sentAt.filter((t) => now - t < HOUR_MS)
      if (this.sentAt.length >= MAX_ALERTS_PER_HOUR) {
        this.skippedByCap += 1
        return
      }

      const message = buildAlertMail(event, err, {
        repeats: prev?.suppressed ?? 0,
        skipped: this.skippedByCap,
        commit: currentCommit(),
        at: new Date(now),
      })
      this.skippedByCap = 0
      this.lastSent.set(key, { at: now, suppressed: 0 })
      this.sentAt.push(now)
      this.prune(now)

      const job: Promise<unknown> = Promise.all(to.map((addr) => this.mail.send({ to: addr, ...message })))
        .then((results) => {
          const failed = results.filter((r) => !r.sent).length
          if (failed) this.logger.warn(`Письмо-оповещение не доставлено получателям: ${failed} из ${results.length}`)
        })
        .catch(() => undefined)
        .finally(() => this.pending.delete(job))
      this.pending.add(job)
    } catch (e) {
      // Сбой самого оповещения не должен ломать обработку запроса.
      this.logger.warn(`Не удалось подготовить оповещение: ${e instanceof Error ? e.name : 'ошибка'}`)
    }
  }

  /**
   * Тестовое письмо по кнопке владельца: проверяет весь путь (адреса, ключ Resend, домен) и говорит, что не так.
   * Не зависит от повторов и лимита в час.
   */
  async sendTest(): Promise<AlertTestResult> {
    const to = this.recipients()
    if (!to.length) return { ok: false, reason: 'NO_RECIPIENTS', recipients: 0 }
    if (!this.mail.isConfigured()) return { ok: false, reason: 'MAIL_NOT_CONFIGURED', recipients: to.length }

    const text = [
      'Это проверочное письмо «Мактаби ман».',
      '',
      'Если вы его читаете, оповещения об ошибках сервера работают: при поломке письмо придёт на этот адрес.',
      `Версия сервера: ${currentCommit() ?? 'неизвестна'}`,
    ].join('\n')
    const results = await Promise.all(
      to.map((addr) =>
        this.mail.send({
          to: addr,
          subject: '[Мактаби ман] Проверка оповещений',
          text,
          html: `<p>Это проверочное письмо «Мактаби ман».</p><p>Если вы его читаете, оповещения об ошибках сервера работают: при поломке письмо придёт на этот адрес.</p>`,
        }),
      ),
    )
    const failed = results.find((r) => !r.sent)
    if (failed && !failed.sent) {
      return {
        ok: false,
        reason: failed.reason === 'REJECTED' ? 'MAIL_REJECTED' : failed.reason === 'NETWORK' ? 'MAIL_NETWORK' : 'MAIL_NOT_CONFIGURED',
        recipients: to.length,
        detail: failed.detail,
      }
    }
    return { ok: true, recipients: to.length }
  }

  /** Дождаться отправки уже поставленных писем (перед остановкой процесса), но не дольше timeoutMs. */
  async flush(timeoutMs = 3000): Promise<void> {
    if (!this.pending.size) return
    let timer: NodeJS.Timeout | undefined
    await Promise.race([
      Promise.allSettled([...this.pending]),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs)
      }),
    ])
    if (timer) clearTimeout(timer)
  }

  private prune(now: number) {
    if (this.lastSent.size < 200) return
    for (const [key, v] of this.lastSent) if (now - v.at >= DEDUPE_MS) this.lastSent.delete(key)
  }
}
