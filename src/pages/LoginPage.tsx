import { useState } from 'react'
import { Form, Input, App as AntdApp, Spin, Modal } from 'antd'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Info,
  Lock,
  MessageCircle,
  Moon,
  Smartphone,
  Sun,
  User,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { http } from '../api'
import { SP, SproutLogo } from '../components/sprout'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useT } from '../i18n'

interface LoginValues {
  /** Email или телефон — тип определяем по наличию «@». */
  login: string
  password: string
}

/**
 * Одна форма для всех ролей: систему не интересует, кто входит —
 * роль берётся из аккаунта. Есть «@» — это email; только цифры, «+» и скобки — телефон;
 * всё остальное — логин ученика (его выдаёт классный руководитель).
 */
export function buildLoginPayload(login: string, password: string) {
  const v = login.trim()
  if (v.includes('@')) return { email: v.toLowerCase(), password }
  if (/^[+\d(][\d\s()-]*$/.test(v)) return { phone: v, password }
  return { login: v.toLowerCase(), password }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { message } = AntdApp.useApp()
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  // «Забыли пароль?» — если у аккаунта есть email, сервер шлёт на него ссылку для
  // смены пароля; иначе запрос уходит администратору (in-app уведомление), и он
  // отправляет человеку ссылку из карточки пользователя. Пароль не называет никто.
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotValue, setForgotValue] = useState('')

  const openForgot = () => {
    setForgotValue(form.getFieldValue('login') || '')
    setForgotOpen(true)
  }

  const submitForgot = async () => {
    const v = forgotValue.trim()
    if (!v) {
      message.warning(t('login.forgotEnter'))
      return
    }
    const payload = v.includes('@')
      ? { email: v.toLowerCase() }
      : { phone: v }
    try {
      setForgotLoading(true)
      const res = await http.post('/v1/auth/forgot-password', payload)
      message.success(res?.data?.message ?? t('login.forgotOk'), 6)
      setForgotOpen(false)
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('login.forgotFail'))
    } finally {
      setForgotLoading(false)
    }
  }

  const onFinish = async (values: LoginValues) => {
    try {
      setLoading(true)
      const loginData = buildLoginPayload(values.login, values.password)

      const response = await http.post('/v1/auth/login', loginData)
      const { user, accessToken } = response.data

      if (!user || !accessToken) {
        message.error(t('login.badResponse'))
        return
      }

      // Сохраняем токен и тут же запрашиваем /me — чтобы получить institution.type
      // и сразу корректно показать UI-лейблы.
      let institution = null
      let homeroomGroups: Array<{ id: string; name: string }> = []
      try {
        const meResp = await http.get('/v1/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        institution = meResp.data?.institution ?? null
        homeroomGroups = meResp.data?.homeroomGroups ?? []
      } catch {
        // некритично: подписи интерфейса от учреждения не зависят
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
          studentId: user.studentId ?? undefined,
          institution,
          homeroomGroups,
          features: user.features,
        },
        accessToken,
      )

      message.success(t('login.welcome', { name: user.fullName }))
      // Куда редиректить по роли:
      //   PARENT → личный кабинет родителя
      //   TEACHER → свой кабинет
      //   ADMIN/SUPER_ADMIN → дашборд админа
      const isTeacher = user.role === 'TEACHER' || user.role === 'teacher'
      const isParent = user.role === 'PARENT'
      const isStudent = user.role === 'STUDENT'
      const path = user.role === 'VIEWER'
        ? '/ministry/overview'
        : isStudent
        ? '/student/home'
        : isParent
          ? '/parent/home'
        : isTeacher
          ? '/teacher/dashboard'
          : '/admin/dashboard'
      navigate(path, { replace: true })
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        t('login.failed')
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const mode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)

  return (
    <div className="login-grid">
      {/* Левая часть — приветствие */}
      <div className="login-visual">
        <div className="login-brand">
          <SproutLogo size={22} />
        </div>
        <div className="sp-chip login-chip">
          <span className="login-chip-dot" />
          {t('login.chip')}
        </div>
        <h1 className="login-title">
          {t('login.title1')}{' '}
          <span className="login-title-accent">{t('login.title2')}</span>
        </h1>
        <p className="login-lead">{t('login.lead')}</p>
        <div className="login-features">
          {[
            { Icon: BarChart3, title: t('login.feat.journal'), sub: t('login.feat.journalSub'), bg: SP.primarySoft, fg: SP.primaryDeep },
            { Icon: MessageCircle, title: t('login.feat.chat'), sub: t('login.feat.chatSub'), bg: SP.roseSoft, fg: SP.roseDeep },
            { Icon: Smartphone, title: t('login.feat.apps'), sub: t('login.feat.appsSub'), bg: SP.blueSoft, fg: SP.blueDeep },
          ].map(({ Icon, title, sub, bg, fg }) => (
            <div key={title} className="login-feature">
              <div className="login-feature-icon" style={{ background: bg, color: fg }}>
                <Icon size={20} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: SP.text }}>{title}</div>
              <div style={{ fontSize: 12.5, color: SP.textMid, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Правая часть — форма */}
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="login-card-top">
          {/* На узких экранах левой части нет — логотип над формой */}
          <div className="login-mobile-logo">
            <SproutLogo size={19} />
          </div>
          <div className="login-card-tools">
            <LanguageSwitcher variant="login" />
            <button
              type="button"
              className="login-theme-btn"
              onClick={toggleTheme}
              aria-label={mode === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {mode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </div>

        <div>
          <h2 className="login-card-title">{t('login.cardTitle')}</h2>
          <p style={{ color: SP.textMid, fontSize: 15, margin: '6px 0 0' }}>
            {t('login.cardSub')}
          </p>
        </div>

        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            style={{ marginTop: 4 }}
          >
            <Form.Item
              label={<span className="login-label">{t('login.loginLabel')}</span>}
              name="login"
              rules={[{ required: true, message: t('login.loginRequired') }]}
            >
              <Input
                size="large"
                prefix={<User size={18} color="var(--sp-muted)" />}
                placeholder={t('login.loginPlaceholder')}
                autoComplete="username"
                disabled={loading}
                style={{ height: 50 }}
              />
            </Form.Item>

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
                  <span className="login-label">{t('login.passwordLabel')}</span>
                  <button type="button" onClick={openForgot} className="login-link">
                    {t('login.forgot')}
                  </button>
                </div>
              }
              name="password"
              rules={[{ required: true, message: t('login.passwordRequired') }]}
            >
              <Input.Password
                size="large"
                prefix={<Lock size={18} color="var(--sp-muted)" />}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                style={{ height: 50 }}
              />
            </Form.Item>

            <button type="submit" className="sp-btn-primary login-submit" disabled={loading}>
              {t('login.submit')}
              <ArrowRight size={18} strokeWidth={2.2} />
            </button>
          </Form>
        </Spin>

        <div className="login-hint">
          <Info size={20} style={{ flex: 'none' }} />
          <span>{t('login.hint')}</span>
        </div>

        <p style={{ color: SP.muted, fontSize: 12.5, margin: 0, textAlign: 'center' }}>{t('login.studentHint')}</p>

        <Modal
          open={forgotOpen}
          onCancel={() => setForgotOpen(false)}
          onOk={submitForgot}
          okText={t('login.forgotSend')}
          cancelText={t('common.cancel')}
          confirmLoading={forgotLoading}
          title={t('login.forgotTitle')}
          destroyOnClose
        >
          <p style={{ color: SP.textMid, fontSize: 13.5, marginTop: 0 }}>
            {t('login.forgotBody')}
          </p>
          <Input
            placeholder={t('login.forgotPlaceholder')}
            value={forgotValue}
            onChange={(e) => setForgotValue(e.target.value)}
            onPressEnter={submitForgot}
            disabled={forgotLoading}
            style={{ height: 42 }}
          />
        </Modal>
      </motion.div>

      <style>{`
        .login-grid {
          position: relative;
          min-height: 100vh;
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 24px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 48px;
        }
        .login-visual {
          flex: 1 1 440px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 22px;
          align-self: center;
        }
        .login-chip {
          background: var(--sp-surface);
          border: 1px solid var(--sp-glass-border);
          color: var(--sp-primary-deep);
          padding: 6px 14px;
        }
        .login-chip-dot {
          width: 7px; height: 7px; border-radius: 50%; background: var(--sp-rose);
        }
        .login-title {
          margin: 0;
          font-family: 'Mont Black', sans-serif;
          font-weight: 800;
          font-size: clamp(34px, 4vw, 54px);
          line-height: 1.08;
          letter-spacing: -0.02em;
          max-width: 540px;
          color: var(--sp-text);
        }
        .login-title-accent { color: var(--sp-primary-deep); }
        .login-lead {
          margin: 0;
          font-size: 18px;
          line-height: 1.6;
          color: var(--sp-text-mid);
          max-width: 470px;
        }
        .login-features { display: flex; gap: 26px; flex-wrap: wrap; margin-top: 8px; }
        .login-feature { max-width: 140px; }
        .login-feature-icon {
          width: 42px; height: 42px; border-radius: 13px;
          display: grid; place-items: center; margin-bottom: 8px;
        }
        .login-card {
          flex: 0 1 460px;
          min-width: 0;
          margin: 0 auto;
          padding: 36px;
          border-radius: 32px;
          background: var(--sp-surface);
          border: 1px solid var(--sp-glass-border);
          -webkit-backdrop-filter: blur(28px) saturate(170%);
          backdrop-filter: blur(28px) saturate(170%);
          box-shadow: 0 40px 80px -40px rgba(7, 40, 42, 0.55);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .login-card-top { display: flex; justify-content: space-between; align-items: center; min-height: 44px; }
        .login-card-tools { margin-left: auto; display: flex; align-items: center; gap: 8px; }
        .login-card-title {
          margin: 0;
          font-family: 'Inter', sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--sp-text);
        }
        .login-label { font-size: 14px; font-weight: 600; color: var(--sp-text); }
        .login-card .ant-form-item-label,
        .login-card .ant-form-item-label > label { width: 100%; }
        .login-card .ant-form-item-label > label::after { display: none; }
        .login-link {
          font-size: 13px; font-weight: 600; color: var(--sp-primary-deep);
          background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
        }
        .login-link:hover { text-decoration: underline; }
        .login-submit {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 16px; font-size: 17px; border-radius: 16px; margin-top: 6px;
        }
        .login-theme-btn {
          width: 44px; height: 44px; border-radius: 14px;
          border: 1px solid var(--sp-border);
          background: var(--sp-surface-alt);
          color: var(--sp-text);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background-color 0.18s ease, transform 0.12s ease;
        }
        .login-theme-btn:hover { background: var(--sp-nav-hover); }
        .login-theme-btn:active { transform: scale(0.97); }
        .login-hint {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px; border-radius: 14px;
          background: var(--sp-rose-soft);
          color: var(--sp-rose-deep);
          font-size: 14px; line-height: 1.45;
        }
        .login-mobile-logo { display: none; }
        @media (max-width: 900px) {
          .login-grid { padding: 20px 16px; gap: 0; align-items: flex-start; justify-content: center; }
          .login-visual { display: none; }
          .login-mobile-logo { display: block; min-width: 0; max-width: 100%; }
          .login-card { padding: 24px 20px; border-radius: 28px; width: 100%; flex-basis: 460px; }
        }
        @media (max-width: 480px) {
          .login-card-title { font-size: 24px; }
          .login-card-top { flex-wrap: wrap; gap: 16px; }
          .login-mobile-logo { flex-basis: 100%; }
          .login-card-tools { margin-left: auto; }
        }
      `}</style>
    </div>
  )
}
