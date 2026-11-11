import { uiText } from '../i18n/uiText'
import { useState } from 'react'
import { App as AntdApp, Button, Tooltip } from 'antd'
import { BellOutlined } from '@ant-design/icons'

import { monitoringApi, type AlertTestResult } from '../api/monitoringApi'

/** Что показать владельцу по итогу проверки: либо «письмо ушло», либо понятно, чего не хватает. */
export function describeAlertTest(r: AlertTestResult): { ok: boolean; text: string } {
  if (r.ok) {
    return {
      ok: true,
      text: uiText("Проверочное письмо отправлено (адресов: {0}). Найдите «Проверка оповещений» в почте, загляните и в «Спам».", r.recipients),
    }
  }
  switch (r.reason) {
    case 'NO_RECIPIENTS':
      return { ok: false, text: uiText("Оповещения выключены: в Railway не задана переменная ALERT_EMAIL. Впишите туда свою почту.") }
    case 'MAIL_NOT_CONFIGURED':
      return { ok: false, text: uiText("Почта на сервере не настроена: в Railway нет RESEND_API_KEY.") }
    case 'MAIL_REJECTED':
      return {
        ok: false,
        text: uiText("Почтовый сервис отклонил письмо{0}. Проверьте домен и ключ в Resend.", r.detail ? `: ${r.detail}` : ''),
      }
    case 'MAIL_NETWORK':
      return { ok: false, text: uiText("Не удалось связаться с почтовым сервисом. Попробуйте ещё раз позже.") }
    default:
      return { ok: false, text: uiText("Не удалось отправить проверочное письмо.") }
  }
}

/** Кнопка владельца платформы: проверить, что письма об ошибках сервера доходят. */
export default function AlertsCheckButton() {
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(false)

  const check = async () => {
    setLoading(true)
    try {
      const { ok, text } = describeAlertTest(await monitoringApi.testAlert())
      if (ok) message.success(text, 8)
      else message.warning(text, 10)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      message.error(e.response?.data?.message || uiText("Не удалось выполнить проверку: сервер не ответил."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title={uiText("Отправит тестовое письмо на ALERT_EMAIL: так вы узнаете, что при поломке сервера письмо придёт")}>
      <Button icon={<BellOutlined />} loading={loading} onClick={check}>
        {" " + uiText("Проверить оповещения") + " "}</Button>
    </Tooltip>
  )
}
