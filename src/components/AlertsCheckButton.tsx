import { useState } from 'react'
import { App as AntdApp, Button, Tooltip } from 'antd'
import { BellOutlined } from '@ant-design/icons'

import { monitoringApi, type AlertTestResult } from '../api/monitoringApi'

/** Что показать владельцу по итогу проверки: либо «письмо ушло», либо понятно, чего не хватает. */
export function describeAlertTest(r: AlertTestResult): { ok: boolean; text: string } {
  if (r.ok) {
    return {
      ok: true,
      text: `Проверочное письмо отправлено (адресов: ${r.recipients}). Найдите «Проверка оповещений» в почте, загляните и в «Спам».`,
    }
  }
  switch (r.reason) {
    case 'NO_RECIPIENTS':
      return { ok: false, text: 'Оповещения выключены: в Railway не задана переменная ALERT_EMAIL. Впишите туда свою почту.' }
    case 'MAIL_NOT_CONFIGURED':
      return { ok: false, text: 'Почта на сервере не настроена: в Railway нет RESEND_API_KEY.' }
    case 'MAIL_REJECTED':
      return {
        ok: false,
        text: `Почтовый сервис отклонил письмо${r.detail ? `: ${r.detail}` : ''}. Проверьте домен и ключ в Resend.`,
      }
    case 'MAIL_NETWORK':
      return { ok: false, text: 'Не удалось связаться с почтовым сервисом. Попробуйте ещё раз позже.' }
    default:
      return { ok: false, text: 'Не удалось отправить проверочное письмо.' }
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
      message.error(e.response?.data?.message || 'Не удалось выполнить проверку: сервер не ответил.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title="Отправит тестовое письмо на ALERT_EMAIL: так вы узнаете, что при поломке сервера письмо придёт">
      <Button icon={<BellOutlined />} loading={loading} onClick={check}>
        Проверить оповещения
      </Button>
    </Tooltip>
  )
}
