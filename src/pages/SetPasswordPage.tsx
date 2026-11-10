import { localizeCopy, uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import { Form, Input, App as AntdApp, Spin } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../api'
import { SP, SproutLogo } from '../components/sprout'

/** Что отвечает GET /v1/auth/password-token/:token. */
type TokenState =
  | { status: 'loading' }
  | { status: 'ok'; purpose: 'INVITE' | 'RESET'; email: string }
  | { status: 'bad'; reason: 'INVALID' | 'EXPIRED' | 'USED' | 'NO_TOKEN' }
  | { status: 'done' }

export const MIN_PASSWORD = 8

const BAD_TEXT: Record<'INVALID' | 'EXPIRED' | 'USED' | 'NO_TOKEN', string> = localizeCopy({
  NO_TOKEN: 'В адресе нет ссылки для установки пароля. Откройте ссылку из письма целиком.',
  INVALID: 'Ссылка недействительна. Возможно, её заменила более новая.',
  EXPIRED: 'Срок действия ссылки истёк.',
  USED: 'Эта ссылка уже использована.',
})

interface FormValues {
  password: string
  repeat: string
}

/**
 * Страница по ссылке из письма: приглашение (директор, учитель…) или сброс
 * пароля. Человек сам придумывает пароль, мы его никому не показываем.
 * Токен одноразовый: после успеха ссылка перестаёт работать.
 */
export default function SetPasswordPage() {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<TokenState>(token ? { status: 'loading' } : { status: 'bad', reason: 'NO_TOKEN' })
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<FormValues>()

  useEffect(() => {
    if (!token) return
    let cancelled = false
    http
      .get(`/v1/auth/password-token/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return
        const d = res.data as
          | { valid: true; purpose: 'INVITE' | 'RESET'; email: string }
          | { valid: false; reason: 'INVALID' | 'EXPIRED' | 'USED' }
        setState(d.valid ? { status: 'ok', purpose: d.purpose, email: d.email } : { status: 'bad', reason: d.reason })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'bad', reason: 'INVALID' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const onFinish = async (v: FormValues) => {
    try {
      setSaving(true)
      await http.post('/v1/auth/set-password', { token, password: v.password })
      setState({ status: 'done' })
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось сохранить пароль. Попробуйте позже."))
    } finally {
      setSaving(false)
    }
  }

  const title =
    state.status === 'ok' && state.purpose === 'INVITE'
      ? uiText("Добро пожаловать!")
      : state.status === 'done'
        ? uiText("Пароль сохранён")
        : state.status === 'bad'
          ? uiText("Ссылка не работает")
          : uiText("Новый пароль")

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: `linear-gradient(160deg, ${SP.primarySoft} 0%, ${SP.bg} 55%)`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          // цвета темы: в тёмной теме карточка тёмная, а текст светлый
          background: SP.solid,
          border: `1px solid ${SP.borderSoft}`,
          borderRadius: 28,
          padding: 'clamp(28px, 6vw, 48px)',
          boxShadow: '0 28px 70px -28px rgba(15,42,34,0.4)',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <SproutLogo size={28} />
        </div>

        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: SP.text }}>{title}</h2>

        {state.status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <Spin />
          </div>
        )}

        {state.status === 'bad' && (
          <>
            <p style={{ color: SP.textMid, fontSize: 16, lineHeight: 1.5, margin: '12px 0 8px' }}>{BAD_TEXT[state.reason]}</p>
            <p style={{ color: SP.muted, fontSize: 14, lineHeight: 1.5, margin: '0 0 26px' }}>
              {" " + uiText("Чтобы получить новую ссылку, нажмите «Забыли?» на странице входа или попросите администратора прислать приглашение заново.") + " "}</p>
            <button type="button" className="sp-btn-primary" style={{ width: '100%', padding: 17, fontSize: 17 }} onClick={() => navigate('/login')}>
              {" " + uiText("На страницу входа") + " "}</button>
          </>
        )}

        {state.status === 'ok' && (
          <>
            <p style={{ color: SP.textMid, fontSize: 16, lineHeight: 1.5, margin: '10px 0 28px' }}>
              {state.purpose === 'INVITE'
                ? uiText("Придумайте пароль, с которым вы будете входить в систему.")
                : uiText("Придумайте новый пароль для входа.")}{' '}
              {" " + uiText("Аккаунт:") + " "}<b style={{ color: SP.text }}>{state.email}</b>
            </p>
            <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish}>
              <Form.Item
                name="password"
                label={<span style={{ fontSize: 14.5, fontWeight: 700, color: SP.text }}>{uiText("Новый пароль")}</span>}
                rules={[
                  { required: true, message: uiText("Введите пароль") },
                  { min: MIN_PASSWORD, message: uiText("Минимум {0} символов", MIN_PASSWORD) },
                ]}
              >
                <Input.Password placeholder={uiText("Минимум 8 символов")} autoComplete="new-password" disabled={saving} style={{ height: 54, fontSize: 16 }} />
              </Form.Item>
              <Form.Item
                name="repeat"
                label={<span style={{ fontSize: 14.5, fontWeight: 700, color: SP.text }}>{uiText("Повторите пароль")}</span>}
                dependencies={['password']}
                rules={[
                  { required: true, message: uiText("Повторите пароль") },
                  ({ getFieldValue }) => ({
                    validator: (_, value) =>
                      !value || getFieldValue('password') === value
                        ? Promise.resolve()
                        : Promise.reject(new Error(uiText("Пароли не совпадают"))),
                  }),
                ]}
              >
                <Input.Password placeholder={uiText("Ещё раз")} autoComplete="new-password" disabled={saving} style={{ height: 54, fontSize: 16 }} />
              </Form.Item>
              <button type="submit" className="sp-btn-primary" style={{ width: '100%', padding: 17, marginTop: 8, fontSize: 17 }} disabled={saving}>
                {saving ? uiText("Сохраняем…") : uiText("Сохранить пароль")}
              </button>
            </Form>
          </>
        )}

        {state.status === 'done' && (
          <>
            <p style={{ color: SP.textMid, fontSize: 16, lineHeight: 1.5, margin: '12px 0 28px' }}>
              {" " + uiText("Готово. Теперь можно войти с новым паролем. Ссылка из письма больше не действует.") + " "}</p>
            <button type="button" className="sp-btn-primary" style={{ width: '100%', padding: 17, fontSize: 17 }} onClick={() => navigate('/login')}>
              {" " + uiText("Войти") + " "}</button>
          </>
        )}
      </div>
    </div>
  )
}
