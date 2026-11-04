import { labels, type UiLabels } from '../lib/labels'

/**
 * Подписи интерфейса. Платформа только для школ: «класс», «ученик», «учитель».
 * Хук оставлен, чтобы страницы не менялись, если подписи когда-то
 * станут зависеть от настроек школы.
 */
export function useLabels(): UiLabels {
  return labels()
}
