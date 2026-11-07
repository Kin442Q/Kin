import { http } from './http'

/** Итог проверки оповещений об ошибках сервера (кнопка у владельца платформы). */
export interface AlertTestResult {
  ok: boolean
  /** NO_RECIPIENTS — не задан ALERT_EMAIL; MAIL_* — почта не настроена или провайдер отказал. */
  reason?: 'NO_RECIPIENTS' | 'MAIL_NOT_CONFIGURED' | 'MAIL_REJECTED' | 'MAIL_NETWORK'
  recipients: number
  detail?: string
}

export const monitoringApi = {
  /** Отправить проверочное письмо на ALERT_EMAIL (только владелец платформы). */
  testAlert: () => http.post<AlertTestResult>('/v1/monitoring/test-alert').then((r) => r.data),
}
