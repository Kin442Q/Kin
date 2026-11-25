import { Injectable, Logger } from '@nestjs/common'

/**
 * Заглушка SMS-уведомлений родителям.
 *
 * SMS НЕ отправляются: у платформы пока нет SMS-провайдера (нужен договор с оператором/агрегатором и имя
 * отправителя). Сервис уже стоит в местах, где SMS понадобятся (отсутствие ученика), поэтому, когда провайдер
 * появится, достаточно реализовать `send` и включить переменную окружения — менять вызывающий код не придётся.
 *
 * Что понадобится от владельца: провайдер с API для Таджикистана, договор, одобренное имя отправителя,
 * логин/ключ API (кладутся в переменные окружения сервера, не в код).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  /** Включено ли реально: пока всегда false. TODO: true, когда задан SMS_PROVIDER и ключ API. */
  isConfigured(): boolean {
    return false
  }

  /**
   * Отправить SMS на телефоны. Пока ничего не отправляет и возвращает причину.
   * TODO: вызвать API провайдера, учесть лимиты и повторы.
   */
  async send(
    phones: string[],
    text: string,
  ): Promise<{ sent: number; skipped: 'sms-provider-not-configured' }> {
    if (phones.length) {
      this.logger.debug(
        `SMS не отправлено (провайдер не настроен): ${phones.length} номер(ов), ${text.length} символов`,
      )
    }
    return { sent: 0, skipped: 'sms-provider-not-configured' }
  }
}
