import { uiText } from '../../i18n/uiText'
import { ReactNode } from 'react'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { hasFeature, type FeatureKey } from '../../lib/features'
import type { Role } from '../../types'

interface Props {
  roles: Role[]
  /** Раздел платформы: если он выключен для учреждения — страница закрыта. */
  feature?: FeatureKey
  children: ReactNode
}

/**
 * Не пускает на страницу пользователей с неподходящей ролью или в выключенный
 * для их учреждения раздел. Показывает Antd Result с кнопкой «Назад».
 */
export default function RequireRole({ roles, feature, children }: Props) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  if (!user) return null

  const isTeacher = user.role === 'TEACHER' || user.role === 'teacher'
  const home =
    user.role === 'VIEWER'
      ? '/ministry/overview'
      : user.role === 'STUDENT'
      ? '/student/home'
      : user.role === 'PARENT'
        ? '/parent/home'
        : isTeacher
          ? '/teacher/dashboard'
          : '/admin/dashboard'

  if (!roles.includes(user.role)) {
    return (
      <Result
        status="403"
        title={uiText("Нет доступа")}
        subTitle={uiText("У вашей роли нет прав на просмотр этой страницы.")}
        extra={
          <Button type="primary" onClick={() => navigate(home)}>
            {" " + uiText("На главную") + " "}</Button>
        }
      />
    )
  }

  if (feature && !hasFeature(user, feature)) {
    return (
      <Result
        status="403"
        title={uiText("Раздел отключён")}
        subTitle={uiText("Этот раздел не подключён для вашего учреждения. Обратитесь к администратору платформы.")}
        extra={
          <Button type="primary" onClick={() => navigate(home)}>
            {" " + uiText("На главную") + " "}</Button>
        }
      />
    )
  }

  return <>{children}</>
}
