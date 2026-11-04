import type { User } from '../api/auth'

/**
 * Разделы платформы (зеркало web/src/lib/features.ts и
 * server/src/modules/features/feature-registry.ts). Включённые для учреждения
 * приходят в `user.features` из /auth/me.
 */
export type FeatureKey =
  | 'groups'
  | 'students'
  | 'teachers'
  | 'subjects'
  | 'terms'
  | 'homeroom'
  | 'attendance'
  | 'schedule'
  | 'menu'
  | 'grades'
  | 'homework'
  | 'diary'
  | 'portal'
  | 'library'
  | 'quiz'
  | 'exam_prep'
  | 'games'
  | 'payments'
  | 'expenses'
  | 'analytics'
  | 'staff'
  | 'timesheet'
  | 'meetings'
  | 'chat'

/**
 * Доступен ли раздел. Владельцу платформы (нет учреждения) и сессии, где
 * список ещё не загружен, — да: выключенное всё равно закрывает бэкенд.
 */
export function hasFeature(user: User | null | undefined, key: FeatureKey): boolean {
  if (!user) return false
  if (!user.kindergartenId) return true
  if (!user.features) return true
  return user.features.includes(key)
}
