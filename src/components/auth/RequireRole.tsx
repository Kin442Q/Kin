import { ReactNode } from 'react'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { Role } from '../../types'

interface Props {
  roles: Role[]
  children: ReactNode
}

/**
 * Не пускает на страницу пользователей с неподходящей ролью.
 * Показывает Antd Result с кнопкой «Назад».
 */
export default function RequireRole({ roles, children }: Props) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  if (!user) return null
  if (!roles.includes(user.role)) {
    return (
      <Result
        status="403"
        title="Нет доступа"
        subTitle="У вашей роли нет прав на просмотр этой страницы."
        extra={
          <Button type="primary" onClick={() => navigate('/admin/dashboard')}>
            На главную
          </Button>
        }
      />
    )
  }
  return <>{children}</>
}
