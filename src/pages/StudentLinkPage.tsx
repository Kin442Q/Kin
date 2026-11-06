import { useEffect, useRef, useState } from 'react'
import { Spin } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'

import { http } from '../api'
import { useAuthStore } from '../store/authStore'
import { SP, SproutLogo } from '../components/sprout'

/**
 * Открыли личную ссылку `/s/<токен>`: входим в кабинет ученика без логина и пароля.
 * Сервер проверяет подпись и версию ссылки; сессия запоминается на этом устройстве
 * (refresh-cookie), поэтому в следующий раз ссылка не нужна.
 */
export default function StudentLinkPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [failed, setFailed] = useState<string | null>(null)
  // StrictMode в деве монтирует эффект дважды — ссылку отправляем один раз
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      try {
        const res = await http.post('/v1/auth/student-link', { token })
        const { user, accessToken } = res.data ?? {}
        if (!user || !accessToken) throw new Error('bad-response')

        // /me нужен ради учреждения и разделов школы — как после обычного входа
        let institution = null
        try {
          const me = await http.get('/v1/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
          institution = me.data?.institution ?? null
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
            homeroomGroups: [],
            features: user.features,
          },
          accessToken,
        )
        navigate('/student/home', { replace: true })
      } catch (e: any) {
        // кабинет выключен школой — это отдельное объяснение; остальное — «ссылка не работает»
        const msg: string | undefined = e?.response?.data?.message
        setFailed(
          msg && /отключ/i.test(msg)
            ? msg
            : 'Ссылка не работает. Попросите классного руководителя выдать новую.',
        )
      }
    })()
  }, [token, login, navigate])

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
        {failed ? (
          <>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: SP.text }}>
              Не получилось войти
            </h2>
            <p role="alert" style={{ color: SP.textMid, fontSize: 16, lineHeight: 1.5, margin: '12px 0 28px' }}>
              {failed}
            </p>
            <button type="button" className="sp-btn-primary" style={{ width: '100%', padding: 17, fontSize: 17 }} onClick={() => navigate('/login')}>
              На страницу входа
            </button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: SP.text }}>Входим…</h2>
            <div style={{ textAlign: 'center', padding: '28px 0 8px' }}>
              <Spin />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
