import { useAuthStore } from '../store/authStore'
import { labels, type UiLabels } from '../lib/labels'

/**
 * Хук-обёртка для веба. Возвращает лейблы UI исходя из институции пользователя.
 * Если у пользователя нет привязки или type = KINDERGARTEN — садиковые лейблы.
 */
export function useLabels(): UiLabels {
  const type = useAuthStore((s) => s.user?.institution?.type)
  return labels(type)
}
