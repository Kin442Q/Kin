import type { User } from '../types'
import { t } from '../i18n'

/**
 * Подпись роли для интерфейса (вместо сырых SUPER_ADMIN / TEACHER) на текущем языке.
 * SUPER_ADMIN без школы — владелец платформы; с привязкой к школе — её директор.
 * Компоненты, которые её показывают, подписаны на язык через useT() и перерисовываются при смене.
 */
export function roleLabel(user: Pick<User, 'role' | 'kindergartenId' | 'homeroomGroups'> | null | undefined): string {
  if (!user) return ''
  switch (user.role) {
    case 'SUPER_ADMIN':
      return user.kindergartenId ? t('role.director') : t('role.owner')
    case 'ADMIN':
    case 'admin':
      return t('role.admin')
    case 'TEACHER':
    case 'teacher':
      return (user.homeroomGroups?.length ?? 0) > 0 ? t('role.homeroom') : t('role.teacher')
    case 'PARENT':
    case 'parent':
      return t('role.parent')
    case 'STUDENT':
      return t('role.student')
    case 'VIEWER':
      return t('role.viewer')
    default:
      return ''
  }
}

/** Инициалы для аватара: «Малика Исмоилова» → «МИ». */
export function initialsOf(fullName: string | null | undefined): string {
  if (!fullName) return '?'
  return (
    fullName
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}
