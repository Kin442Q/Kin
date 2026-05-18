import { useAuthStore } from '../store/authStore'
import { labels, type UiLabels } from './labels'

/**
 * Хук-обёртка: возвращает лейблы UI, исходя из типа учреждения
 * текущего пользователя. Для садика — «группа/ребёнок/воспитатель»,
 * для школы — «класс/ученик/учитель».
 */
export function useLabels(): UiLabels {
  const type = useAuthStore((s) => s.user?.institution?.type)
  return labels(type)
}
