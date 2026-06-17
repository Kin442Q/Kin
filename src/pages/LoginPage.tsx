import { useState } from 'react'
import { Form, Input, App as AntdApp, Spin, Modal } from 'antd'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { BarChart3, MessageCircle, Smartphone } from 'lucide-react'
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
  const [tab, setTab] = useState<'admin' | 'teacher' | 'parent'>('admin')
  const [form] = Form.useForm()

  // «Забыли пароль?» — доступ восстанавливает администратор. Отправляем ему
  // запрос (in-app уведомление), сам сброс пароля он делает в карточке юзера.
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotValue, setForgotValue] = useState('')

  const openForgot = () => {
    const cur =
      tab === 'teacher' ? form.getFieldValue('phone') : form.getFieldValue('email')
    setForgotValue(cur || '')
    setForgotOpen(true)
  }

  const submitForgot = async () => {
    const v = forgotValue.trim()
    if (!v) {
      message.warning('Укажите email или телефон')
      return
    }
    const payload = v.includes('@')
      ? { email: v.toLowerCase() }
      : { phone: v }
    try {
      setForgotLoading(true)
      await http.post('/v1/auth/forgot-password', payload)
      message.success(
        'Запрос отправлен. Администратор сбросит пароль и сообщит вам новый.',
      )
      setForgotOpen(false)
    } catch (error: any) {
      message.error(
        error?.response?.data?.message ||
          'Не удалось отправить запрос. Попробуйте позже.',
      )
    } finally {
      setForgotLoading(false)
    }
  }

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

      // Сохраняем токен и тут же запрашиваем /me — чтобы получить institution.type
      // и сразу корректно показать UI-лейблы.
      let institution = null
      try {
        const meResp = await http.get('/v1/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        institution = meResp.data?.institution ?? null
      } catch {
        // некритично, лейблы будут «садиковыми» по умолчанию
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
          institution,
        },
        accessToken,
      )

      message.success(`Добро пожаловать, ${user.fullName}`)
      // Куда редиректить по роли:
      //   PARENT → личный кабинет родителя
      //   TEACHER → свой кабинет
      //   ADMIN/SUPER_ADMIN → дашборд админа
      const isTeacher = user.role === 'TEACHER' || user.role === 'teacher'
      const isParent = user.role === 'PARENT'
      const path = isParent
        ? '/parent/home'
        : isTeacher
          ? '/teacher/dashboard'
          : '/admin/dashboard'
      navigate(path, { replace: true })
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
            Сад и школа · одна платформа
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
            Управляйте садом и школой
            <br />
            в{' '}
            <span style={{ color: SP.primaryDeep, fontStyle: 'italic' }}>
              одном месте
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
            Дети, оплаты, посещаемость, расписание и оценки — всё в одном
            месте. Аналитика прибыли по группам и уведомления родителям.
          </p>
          <div style={{ display: 'flex', gap: 26, marginTop: 36, flexWrap: 'wrap' }}>
            {[
              {
                Icon: BarChart3,
                title: 'Аналитика',
                sub: 'прибыль по группам',
                bg: SP.primarySoft,
                fg: SP.primaryDeep,
              },
              {
                Icon: MessageCircle,
                title: 'Чат',
                sub: 'с родителями',
                bg: SP.blueSoft,
                fg: SP.blueDeep,
              },
              {
                Icon: Smartphone,
                title: 'Веб + мобильное',
                sub: 'приложение',
                bg: SP.yellowSoft,
                fg: SP.yellowDeep,
              },
            ].map(({ Icon, title, sub, bg, fg }) => (
              <div key={title} style={{ maxWidth: 130 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: bg,
                    color: fg,
                    display: 'grid',
                    placeItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: SP.text }}>
                  {title}
                </div>
                <div style={{ fontSize: 12, color: SP.textMid, marginTop: 2 }}>{sub}</div>
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
                ['admin', '👤 Админ'],
                ['teacher', '👨‍🏫 Учитель'],
                ['parent', '👪 Родитель'],
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
                  padding: '9px 8px',
                  background: tab === k ? SP.surface : 'transparent',
                  color: tab === k ? SP.text : SP.muted,
                  fontSize: 12.5,
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
              {tab !== 'teacher' ? (
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
                    placeholder={
                      tab === 'parent'
                        ? 'parent@kindergarten.tj'
                        : 'admin@kindergarten.tj'
                    }
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
                    <button
                      type="button"
                      onClick={openForgot}
                      style={{
                        fontSize: 11.5,
                        color: SP.primaryDeep,
                        fontWeight: 600,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Забыли?
                    </button>
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

          <Modal
            open={forgotOpen}
            onCancel={() => setForgotOpen(false)}
            onOk={submitForgot}
            okText="Отправить запрос"
            cancelText="Отмена"
            confirmLoading={forgotLoading}
            title="Восстановление доступа"
            destroyOnClose
          >
            <p style={{ color: SP.textMid, fontSize: 13.5, marginTop: 0 }}>
              Доступ восстанавливает администратор. Укажите email или телефон,
              под которым вы входите — администратор получит запрос и сбросит
              вам пароль.
            </p>
            <Input
              placeholder="email или телефон"
              value={forgotValue}
              onChange={(e) => setForgotValue(e.target.value)}
              onPressEnter={submitForgot}
              disabled={forgotLoading}
              style={{ height: 42 }}
            />
          </Modal>

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
