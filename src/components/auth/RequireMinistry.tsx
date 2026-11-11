import type { ReactNode } from 'react'
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

import { uiText } from '../../i18n/uiText'
import { useAuthStore } from '../../store/authStore'

/**
 * Кабинет министерства открыт наблюдателю и владельцу платформы. Директор школы тоже SUPER_ADMIN,
 * поэтому роли мало: владельца отличает отсутствие школы. Сервер проверяет то же самое независимо.
 */
export function canSeeMinistry(user: { role: string; kindergartenId?: string | null } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'VIEWER' || (user.role === 'SUPER_ADMIN' && !user.kindergartenId)
}

export default function RequireMinistry({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  if (!user) return null
  if (!canSeeMinistry(user)) {
    return (
      <Result
        status="403"
        title={uiText('Нет доступа')}
        subTitle={uiText('У вашей роли нет прав на просмотр этой страницы.')}
        extra={
          <Button type="primary" onClick={() => navigate('/admin/dashboard')}>
            {uiText('На главную')}
          </Button>
        }
      />
    )
  }
  return <>{children}</>
}
