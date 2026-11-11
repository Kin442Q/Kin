import type { User } from '../types'

/**
 * Разделы платформы. Зеркало server/src/modules/features/feature-registry.ts:
 * владелец платформы включает/выключает их для каждого учреждения, бэкенд
 * отдаёт включённые в `user.features` (логин и /auth/me).
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
  | 'lesson_materials'
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
 * Доступен ли раздел пользователю.
 *  - владелец платформы (нет учреждения) — всё доступно;
 *  - features ещё не загружены (старая сессия) — не прячем: бэкенд всё равно
 *    закрывает выключенное, а список обновится первым же запросом /auth/me;
 *  - иначе — по списку включённых.
 */
export function hasFeature(user: User | null | undefined, key: FeatureKey): boolean {
  if (!user) return false
  if (!user.kindergartenId) return true
  if (!user.features) return true
  return user.features.includes(key)
}
