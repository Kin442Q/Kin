import { uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import { Alert, App as AntdApp, Button, Modal } from 'antd'
import { SendOutlined } from '@ant-design/icons'

import type { AccessGrant, MailFailure } from '../api/accessApi'

interface Props {
  /** Чем закончилась выдача доступа; null — окно закрыто. */
  grant: AccessGrant | null
  /** Повторная отправка приглашения; без неё кнопки «ещё раз» нет. Возвращает новый итог. */
  onRetry?: () => Promise<AccessGrant>
  onClose: () => void
}

/** Короткое объяснение, почему письмо не ушло. */
export function mailFailureText(reason: MailFailure, detail?: string): string {
  if (reason === 'NOT_CONFIGURED') return uiText("Почта на сервере ещё не настроена.")
  if (reason === 'REJECTED') {
    const d = detail ? `: ${detail.replace(/\.+$/, '')}` : ''
    return uiText("Почтовый сервис отклонил письмо{0}. Проверьте, что домен отправителя подтверждён.", d)
  }
  return uiText("Не удалось связаться с почтовым сервисом.")
}

/**
 * Итог выдачи доступа. Пароля здесь нет: письмо со ссылкой ушло, и человек сам задаст пароль,
 * либо письмо не ушло — тогда видна причина и можно отправить приглашение ещё раз.
 */
export default function AccessResultModal({ grant, onRetry, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [current, setCurrent] = useState<AccessGrant | null>(grant)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    setCurrent(grant)
  }, [grant])

  const retry = async () => {
    if (!onRetry) return
    try {
      setRetrying(true)
      setCurrent(await onRetry())
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось отправить письмо. Попробуйте позже."))
    } finally {
      setRetrying(false)
    }
  }

  const sent = !!current && current.sent

  return (
    <Modal
      open={!!current}
      onCancel={onClose}
      title={sent ? uiText("Приглашение отправлено") : uiText("Письмо не отправлено")}
      destroyOnClose
      footer={
        <>
          {current && !current.sent && onRetry && (
            <Button icon={<SendOutlined />} loading={retrying} onClick={retry}>
              {" " + uiText("Отправить приглашение ещё раз") + " "}</Button>
          )}
          <Button type="primary" onClick={onClose}>
            {" " + uiText("Готово") + " "}</Button>
        </>
      }
    >
      {current?.sent && (
        <Alert
          type="success"
          showIcon
          message={uiText("Письмо ушло на {0}", current.email)}
          description={uiText("Человек откроет ссылку из письма и сам придумает пароль — вам знать его не нужно. Ссылка действует 48 часов и открывается один раз.")}
        />
      )}

      {current && !current.sent && (
        <Alert
          type="warning"
          showIcon
          message={uiText("Письмо на {0} не ушло", current.email)}
          description={uiText("{0} Аккаунт уже создан: когда почта заработает, отправьте приглашение ещё раз. Пароль никому не передаётся.", mailFailureText(current.reason, current.detail))}
        />
      )}
    </Modal>
  )
}
