import type { User } from '../types'

/**
 * Подпись роли для интерфейса (вместо сырых SUPER_ADMIN / TEACHER).
 * SUPER_ADMIN без школы — владелец платформы; с привязкой к школе — её директор.
 */
export function roleLabel(user: Pick<User, 'role' | 'kindergartenId' | 'homeroomGroups'> | null | undefined): string {
  if (!user) return ''
  switch (user.role) {
    case 'SUPER_ADMIN':
      return user.kindergartenId ? 'Директор' : 'Владелец платформы'
    case 'ADMIN':
    case 'admin':
      return 'Администратор'
    case 'TEACHER':
    case 'teacher':
      return (user.homeroomGroups?.length ?? 0) > 0 ? 'Классный руководитель' : 'Учитель'
    case 'PARENT':
    case 'parent':
      return 'Родитель'
    case 'STUDENT':
      return 'Ученик'
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
