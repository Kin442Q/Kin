import { useState } from 'react'
import {
  Form,
  Input,
  Button,
  Typography,
  App as AntdApp,
  Spin,
  Tabs,
} from 'antd'
import {
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { http } from '../api'
import type { User } from '../types'

const { Title, Paragraph } = Typography

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email?: string; phone?: string; password: string }) => {
    try {
      setLoading(true)
      const loginData = values.phone
        ? { phone: values.phone.trim(), password: values.password }
        : { email: values.email?.trim().toLowerCase(), password: values.password }

      const response = await http.post('/v1/auth/login', loginData)

      const { user, accessToken } = response.data

      // Сохраняем пользователя и токен
      login({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        groupId: user.groupId,
        childId: user.childId,
      }, accessToken)

      message.success(`Добро пожаловать, ${user.fullName}`)
      navigate('/admin/dashboard', { replace: true })
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || 'Ошибка входа'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass w-full max-w-md p-8"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ rotate: -10, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="text-5xl mb-2"
          >
            🌸
          </motion.div>
          <Title level={3} className="!mb-1">
            <span className="logo-gradient">KinderCRM</span>
          </Title>
          <Paragraph className="!mb-0 text-muted">
            Управление детским садом. Войдите, чтобы продолжить.
          </Paragraph>
        </div>

        <Spin spinning={loading}>
          <Tabs
            defaultActiveKey="admin"
            items={[
              {
                key: 'admin',
                label: '👤 Администратор',
                children: (
                  <Form
                    layout="vertical"
                    onFinish={onFinish}
                  >
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[{ required: true, message: 'Введите email' }]}
                    >
                      <Input prefix={<MailOutlined />} placeholder="admin@kindergarten.tj" size="large" disabled={loading} />
                    </Form.Item>
                    <Form.Item
                      label="Пароль"
                      name="password"
                      rules={[{ required: true, message: 'Введите пароль' }]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" disabled={loading} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                      Войти
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'teacher',
                label: '👨‍🏫 Воспитатель',
                children: (
                  <Form
                    layout="vertical"
                    onFinish={onFinish}
                  >
                    <Form.Item
                      label="Номер телефона"
                      name="phone"
                      rules={[{ required: true, message: 'Введите номер телефона' }]}
                    >
                      <Input prefix={<PhoneOutlined />} placeholder="+992 90 123 45 67" size="large" disabled={loading} />
                    </Form.Item>
                    <Form.Item
                      label="Пароль"
                      name="password"
                      rules={[{ required: true, message: 'Введите пароль' }]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" disabled={loading} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                      Войти
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        </Spin>

        <Paragraph className="!mt-6 !mb-0 text-center text-xs text-muted">
          Выберите тип пользователя и введите ваши учетные данные
        </Paragraph>
      </motion.div>
    </div>
  )
}
