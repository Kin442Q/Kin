import { useEffect } from 'react'
import {
  Form,
  Input,
  Button,
  Typography,
  Divider,
  Tag,
  App as AntdApp,
} from 'antd'
import {
  LockOutlined,
  MailOutlined,
  CrownOutlined,
  TeamOutlined,
  UserOutlined,
  HeartOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import type { Role, User } from '../types'

const { Title, Paragraph, Text } = Typography

/**
 * Демо-пресеты для быстрого входа. Email-ы совпадают с теми, что создаются
 * в seedDemo(). Если в сторе ещё нет accounts — кнопки всё равно работают,
 * мы посеетдим данные и попробуем войти ещё раз.
 */
const ROLE_PRESETS: {
  role: Role
  label: string
  email: string
  color: string
  icon: React.ReactNode
}[] = [
  { role: 'super_admin', label: 'Super Admin', email: 'super@kg.app', color: 'magenta', icon: <CrownOutlined /> },
  { role: 'admin', label: 'Admin', email: 'admin@kg.app', color: 'geekblue', icon: <UserOutlined /> },
  { role: 'teacher', label: 'Воспитатель', email: 'zarina@kg.app', color: 'green', icon: <TeamOutlined /> },
  { role: 'parent', label: 'Родитель', email: 'parent@kg.app', color: 'volcano', icon: <HeartOutlined /> },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const accounts = useDataStore((s) => s.accounts)
  const seedDemo = useDataStore((s) => s.seedDemo)
  const { message } = AntdApp.useApp()

  // Если в сторе нет ни одной учётки — подсадим демо-данные.
  useEffect(() => {
    if (accounts.length === 0) seedDemo()
  }, [accounts.length, seedDemo])

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

  const quickLogin = (role: Role) => {
    const preset = ROLE_PRESETS.find((p) => p.role === role)!
    // На случай, если seed ещё не отработал — гарантируем
    if (useDataStore.getState().accounts.length === 0) {
      seedDemo()
    }
    onFinish({ email: preset.email, password: 'demo' })
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
          initialValues={{ email: 'admin@kg.app', password: 'demo' }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Введите email' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="admin@kg.app" size="large" />
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

        <Divider plain>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Быстрый вход (демо)
          </Text>
        </Divider>

        <div className="grid grid-cols-2 gap-2">
          {ROLE_PRESETS.map((p) => (
            <motion.button
              key={p.role}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => quickLogin(p.role)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-black/5 dark:border-white/10 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <Tag color={p.color} style={{ margin: 0 }} icon={p.icon}>
                {p.label}
              </Tag>
            </motion.button>
          ))}
        </div>

        <Paragraph className="!mt-6 !mb-0 text-center text-xs text-muted">
          Учителей можно создавать в разделе «Учителя» под админом.
        </Paragraph>
      </motion.div>
    </div>
  )
}
