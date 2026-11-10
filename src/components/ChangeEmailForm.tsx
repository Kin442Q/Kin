import { uiText } from '../i18n/uiText'
import { useState } from 'react'
import { App as AntdApp, Button, Card, Form, Input } from 'antd'
import { MailOutlined } from '@ant-design/icons'

import { accessApi } from '../api/accessApi'
import { useAuthStore } from '../store/authStore'

interface Values {
  newEmail: string
  current: string
}

/** Смена своего email (он же логин). Нужен текущий пароль. */
export default function ChangeEmailForm() {
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm<Values>()
  const [saving, setSaving] = useState(false)
  const email = useAuthStore((s) => s.user?.email)
  const setToken = useAuthStore((s) => s.setToken)
  const updateUser = useAuthStore((s) => s.updateUser)

  const onFinish = async (v: Values) => {
    setSaving(true)
    try {
      const res = await accessApi.changeEmail({ currentPassword: v.current, newEmail: v.newEmail.trim() })
      setToken(res.accessToken)
      updateUser({ email: res.user.email })
      form.resetFields()
      message.success(uiText("Email для входа изменён"))
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось сменить email"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish}>
      <p style={{ marginTop: 0 }}>
        {" " + uiText("Сейчас вы входите как") + " "}<b>{email}</b>
      </p>
      <Form.Item
        name="newEmail"
        label={uiText("Новый email")}
        rules={[
          { required: true, message: uiText("Введите новый email") },
          { type: 'email', message: uiText("Некорректный email") },
        ]}
      >
        <Input prefix={<MailOutlined />} autoComplete="email" placeholder="new@example.com" disabled={saving} />
      </Form.Item>
      <Form.Item name="current" label={uiText("Текущий пароль")} rules={[{ required: true, message: uiText("Введите текущий пароль") }]}>
        <Input.Password autoComplete="current-password" disabled={saving} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>
        {" " + uiText("Сменить email") + " "}</Button>
    </Form>
  )
}

/** Карточка «Email для входа» для страницы настроек. */
export function ChangeEmailCard() {
  return (
    <Card className="glass" bordered={false} title={<><MailOutlined /> {" " + uiText("Email для входа")}</>} style={{ maxWidth: 460 }}>
      <ChangeEmailForm />
    </Card>
  )
}
