import { useEffect } from 'react'
import { http } from '../api/http'
import { useAuthStore } from '../store/authStore'

/**
 * Освежает данные сессии из /auth/me при старте приложения: включённые
 * разделы и учреждение. Нужно, потому что user лежит в localStorage — без
 * этого старая сессия не узнала бы о разделах, а изменения владельца
 * платформы (включил/выключил раздел) дошли бы только после повторного входа.
 *
 * Ошибки глушим: если сеть недоступна, работаем с тем, что сохранено.
 */
export function useSessionSync() {
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  const updateUser = useAuthStore((s) => s.updateUser)

  useEffect(() => {
    if (!userId || !token) return
    let cancelled = false
    http
      .get('/v1/auth/me')
      .then((r) => {
        if (cancelled) return
        const me = r.data
        updateUser({
          features: me?.features,
          institution: me?.institution ?? null,
          homeroomGroups: me?.homeroomGroups ?? [],
        })
      })
      .catch(() => {
        /* работаем с сохранённым состоянием */
      })
    return () => {
      cancelled = true
    }
  }, [userId, token, updateUser])
}
