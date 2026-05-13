import {
  Form,
  Input,
  Button,
  Typography,
  App as AntdApp,
} from 'antd'
import {
  LockOutlined,
  MailOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import type { User } from '../types'

const { Title, Paragraph } = Typography

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { message } = AntdApp.useApp()

  const onFinish = (values: { email: string; password: string }) => {
    const email = values.email.trim().toLowerCase()
    const account = useDataStore
      .getState()
      .accounts.find((a) => a.email.toLowerCase() === email)

    if (!account) {
      message.error('Пользователь не найден')
      return
    }
    if (account.password !== values.password) {
      message.error('Неверный пароль')
      return
    }

    const user: User = {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      groupId: account.groupId,
    }
    login(user)
    message.success(`Добро пожаловать, ${user.fullName}`)
    navigate('/admin/dashboard', { replace: true })
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

        <Form
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Введите email' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="admin@example.com" size="large" />
          </Form.Item>
          <Form.Item
            label="Пароль"
            name="password"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
            Войти
          </Button>
        </Form>

        <Paragraph className="!mt-6 !mb-0 text-center text-xs text-muted">
          Для входа используйте учетные данные администратора
        </Paragraph>
      </motion.div>
    </div>
  )
}
