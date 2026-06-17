import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as AntdApp, Spin } from 'antd'

import { useAuthStore } from '../store/authStore'
import { http } from '../api'

/**
 * Публичный лендинг (роут «/»). Сам маркетинг лежит статикой в
 * public/landing/index.html и встраивается через iframe (полная изоляция
 * стилей от приложения). Кнопки лендинга шлют postMessage:
 *   { type: 'redi', action: 'demo' }  → вход в живое демо (read-only)
 *   { type: 'redi', action: 'login' } → страница входа
 */
export default function LandingPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { message } = AntdApp.useApp()
  const [loadingDemo, setLoadingDemo] = useState(false)

  const homeFor = (role: string) =>
    role === 'PARENT'
      ? '/parent/home'
      : role === 'TEACHER' || role === 'teacher'
        ? '/teacher/dashboard'
        : '/admin/dashboard'

  const enterDemo = useCallback(async () => {
    try {
      setLoadingDemo(true)
      const resp = await http.post('/v1/auth/demo-login')
      const { user, accessToken } = resp.data || {}
      if (!user || !accessToken) {
        message.error('Демо сейчас недоступно')
        return
      }
      // Подтягиваем institution (тип + isDemo) для лейблов и баннера.
      let institution = null
      try {
        const me = await http.get('/v1/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        institution = me.data?.institution ?? null
      } catch {
        /* некритично */
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
      navigate(homeFor(user.role), { replace: true })
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || 'Не удалось открыть демо. Попробуйте позже.',
      )
    } finally {
      setLoadingDemo(false)
    }
  }, [login, navigate, message])

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data
      if (!d || d.type !== 'redi') return
      if (d.action === 'demo') enterDemo()
      else if (d.action === 'login') navigate('/login')
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [enterDemo, navigate])

  return (
    <>
      <iframe
        title="Лендинг"
        src={`${import.meta.env.BASE_URL}landing/index.html`}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />
      {loadingDemo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.6)',
            zIndex: 9999,
          }}
        >
          <Spin size="large" tip="Открываем демо…" />
        </div>
      )}
    </>
  )
}
