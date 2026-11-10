import { uiText } from '../i18n/uiText'
import { useState } from 'react'
import { App as AntdApp, Button, Card, Form, Input } from 'antd'
import { LockOutlined } from '@ant-design/icons'

import { accessApi } from '../api/accessApi'
import { useAuthStore } from '../store/authStore'

export const MIN_NEW_PASSWORD = 8

interface Values {
  current: string
  next: string
  repeat: string
}

interface Props {
  /** Вызывается после успешной смены (например, закрыть окно). */
  onDone?: () => void
  submitText?: string
}

/**
 * Смена своего пароля: нужен текущий. После смены другие устройства выходят,
 * это остаётся в системе (сервер выдаёт новую сессию). Снимает флаг «сменить пароль».
 */
export default function ChangePasswordForm({ onDone, submitText = uiText("Сменить пароль") }: Props) {
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm<Values>()
  const [saving, setSaving] = useState(false)
  const setToken = useAuthStore((s) => s.setToken)
  const updateUser = useAuthStore((s) => s.updateUser)

  const onFinish = async (v: Values) => {
    setSaving(true)
    try {
      const res = await accessApi.changePassword({ currentPassword: v.current, newPassword: v.next })
      setToken(res.accessToken)
      updateUser({ mustChangePassword: false })
      form.resetFields()
      message.success(uiText("Пароль изменён. На других устройствах нужно войти заново."))
      onDone?.()
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось сменить пароль"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish}>
      <Form.Item name="current" label={uiText("Текущий пароль")} rules={[{ required: true, message: uiText("Введите текущий пароль") }]}>
        <Input.Password autoComplete="current-password" disabled={saving} />
      </Form.Item>
      <Form.Item
        name="next"
        label={uiText("Новый пароль")}
        dependencies={['current']}
        rules={[
          { required: true, message: uiText("Введите новый пароль") },
          { min: MIN_NEW_PASSWORD, message: uiText("Минимум {0} символов", MIN_NEW_PASSWORD) },
          ({ getFieldValue }) => ({
            validator: (_, value) =>
              !value || getFieldValue('current') !== value
                ? Promise.resolve()
                : Promise.reject(new Error(uiText("Новый пароль должен отличаться от текущего"))),
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" placeholder={uiText("Минимум {0} символов", MIN_NEW_PASSWORD)} disabled={saving} />
      </Form.Item>
      <Form.Item
        name="repeat"
        label={uiText("Повторите новый пароль")}
        dependencies={['next']}
        rules={[
          { required: true, message: uiText("Повторите пароль") },
          ({ getFieldValue }) => ({
            validator: (_, value) =>
              !value || getFieldValue('next') === value ? Promise.resolve() : Promise.reject(new Error(uiText("Пароли не совпадают"))),
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" disabled={saving} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>
        {submitText}
      </Button>
    </Form>
  )
}

/** Карточка «Безопасность» для страницы настроек. */
export function ChangePasswordCard() {
  return (
    <Card className="glass" bordered={false} title={<><LockOutlined /> {" " + uiText("Сменить пароль")}</>} style={{ maxWidth: 460 }}>
      <ChangePasswordForm />
    </Card>
  )
}
