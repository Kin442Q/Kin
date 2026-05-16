import { useState } from 'react'
import { Form, Input, App as AntdApp, Spin } from 'antd'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { http } from '../api'
import { SP, SproutLogo } from '../components/sprout'

interface LoginValues {
  email?: string
  phone?: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'admin' | 'teacher'>('admin')
  const [form] = Form.useForm()

  const onFinish = async (values: LoginValues) => {
    try {
      setLoading(true)
      const loginData = values.phone
        ? { phone: values.phone.trim(), password: values.password }
        : {
            email: values.email?.trim().toLowerCase(),
            password: values.password,
          }

      const response = await http.post('/v1/auth/login', loginData)
      const { user, accessToken } = response.data

      if (!user || !accessToken) {
        message.error('Ошибка сервера: некорректный ответ')
        return
      }

      login(
        {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          kindergartenId: user.kindergartenId ?? null,
          groupId: user.groupId ?? undefined,
          childId: user.childId ?? undefined,
        },
        accessToken,
      )

      message.success(`Добро пожаловать, ${user.fullName}`)
      navigate('/admin/dashboard', { replace: true })
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка входа. Проверьте данные'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // Плавающие пузыри на левой панели
  const bubbles = [
    { x: 8, y: 14, s: 88, c: SP.primarySoft, d: 0 },
    { x: 14, y: 78, s: 56, c: SP.yellowSoft, d: 1.2 },
    { x: 76, y: 18, s: 120, c: SP.blueSoft, d: 0.6 },
    { x: 84, y: 72, s: 72, c: SP.primaryGhost, d: 1.8 },
    { x: 42, y: 88, s: 40, c: SP.yellowSoft, d: 2.4 },
    { x: 92, y: 44, s: 28, c: SP.primarySoft, d: 0.3 },
  ]

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: SP.bg,
      }}
      className="login-grid"
    >
      {/* Левая часть — визуал */}
      <div
        style={{
          position: 'relative',
          background: `linear-gradient(160deg, ${SP.primarySoft} 0%, ${SP.yellowSoft} 100%)`,
          padding: 48,
          overflow: 'hidden',
        }}
        className="login-visual"
      >
        {bubbles.map((b, i) => (
          <div
            key={i}
            className="sp-bubble"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.s,
              height: b.s,
              background: b.c,
              animation: `sp-float ${4 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${b.d}s`,
            }}
          />
        ))}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <SproutLogo size={22} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 80, maxWidth: 420 }}>
          <div
            className="sp-chip"
            style={{
              background: SP.surface,
              color: SP.primaryDeep,
              marginBottom: 20,
              padding: '4px 12px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: SP.primary,
              }}
            />
            Новинка · модуль собраний с Telegram
          </div>
          <h1
            style={{
              fontSize: 44,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              margin: 0,
              fontWeight: 700,
              color: SP.text,
            }}
          >
            Управляйте садиком
            <br />
            как{' '}
            <span style={{ color: SP.primaryDeep, fontStyle: 'italic' }}>
              растущим садом
            </span>
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: SP.textMid,
              marginTop: 18,
              marginBottom: 0,
            }}
          >
            Дети, оплаты, посещаемость, расписание — всё в одном месте.
            Аналитика прибыли по группам, уведомления родителям в Telegram.
          </p>
          <div style={{ display: 'flex', gap: 32, marginTop: 36 }}>
            {[
              ['142', 'детей'],
              ['18', 'воспитателей'],
              ['89%', 'посещаемость'],
            ].map(([v, l]) => (
              <div key={l}>
                <div
                  className="sp-num"
                  style={{ fontSize: 28, fontWeight: 700, color: SP.primaryDeep }}
                >
                  {v}
                </div>
                <div style={{ fontSize: 12, color: SP.textMid, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Декоративные листья */}
        <svg
          style={{ position: 'absolute', bottom: -40, left: -30, opacity: 0.4 }}
          width="280"
          height="280"
          viewBox="0 0 200 200"
          fill="none"
        >
          <path
            d="M30 170c0-60 30-100 80-110-10 50-40 90-80 110z"
            fill={SP.primary}
            opacity="0.3"
          />
          <path
            d="M70 180c0-50 25-85 70-95-8 45-32 80-70 95z"
            fill={SP.primaryDeep}
            opacity="0.25"
          />
        </svg>
      </div>

      {/* Правая часть — форма */}
      <div
        style={{
          background: SP.bg,
          display: 'grid',
          placeItems: 'center',
          padding: 48,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 380 }}
        >
          {/* На mobile логотип сверху формы */}
          <div className="login-mobile-logo" style={{ marginBottom: 24 }}>
            <SproutLogo size={20} />
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: SP.text,
            }}
          >
            Добро пожаловать
          </h2>
          <p
            style={{
              color: SP.muted,
              fontSize: 14,
              marginTop: 6,
              marginBottom: 28,
            }}
          >
            Войдите в свой аккаунт, чтобы продолжить
          </p>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              background: SP.surfaceAlt,
              borderRadius: 12,
              marginBottom: 22,
            }}
          >
            {(
              [
                ['admin', '👤 Администратор'],
                ['teacher', '👨‍🏫 Воспитатель'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k)
                  form.resetFields()
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  background: tab === k ? SP.surface : 'transparent',
                  color: tab === k ? SP.text : SP.muted,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: tab === k ? '0 1px 2px rgba(31,45,39,0.04)' : 'none',
                  fontFamily: 'inherit',
                }}
              >
                {l}
              </button>
            ))}
          </div>

          <Spin spinning={loading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
            >
              {tab === 'admin' ? (
                <Form.Item
                  label={
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: SP.textMid }}>
                      Email
                    </span>
                  }
                  name="email"
                  rules={[{ required: true, message: 'Введите email' }]}
                >
                  <Input
                    placeholder="admin@kindergarten.tj"
                    disabled={loading}
                    style={{ height: 44 }}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  label={
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: SP.textMid }}>
                      Номер телефона
                    </span>
                  }
                  name="phone"
                  rules={[{ required: true, message: 'Введите номер телефона' }]}
                >
                  <Input
                    placeholder="+992 90 123 45 67"
                    disabled={loading}
                    style={{ height: 44 }}
                  />
                </Form.Item>
              )}

              <Form.Item
                label={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: SP.textMid }}>
                      Пароль
                    </span>
                    <a
                      href="#"
                      style={{
                        fontSize: 11.5,
                        color: SP.primaryDeep,
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Забыли?
                    </a>
                  </div>
                }
                name="password"
                rules={[{ required: true, message: 'Введите пароль' }]}
              >
                <Input.Password
                  placeholder="••••••••"
                  disabled={loading}
                  style={{ height: 44 }}
                />
              </Form.Item>

              <button
                type="submit"
                className="sp-btn-primary"
                style={{
                  width: '100%',
                  padding: '13px',
                  fontSize: 14,
                  marginTop: 6,
                }}
                disabled={loading}
              >
                Войти →
              </button>
            </Form>
          </Spin>

          <p
            style={{
              fontSize: 12,
              color: SP.muted,
              textAlign: 'center',
              marginTop: 28,
            }}
          >
            Нет аккаунта?{' '}
            <a
              href="#"
              style={{
                color: SP.primaryDeep,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Запросить демо
            </a>
          </p>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .login-grid {
            grid-template-columns: 1fr !important;
          }
          .login-visual {
            display: none;
          }
        }
        .login-mobile-logo {
          display: none;
        }
        @media (max-width: 900px) {
          .login-mobile-logo {
            display: block;
          }
        }
      `}</style>
    </div>
  )
}
