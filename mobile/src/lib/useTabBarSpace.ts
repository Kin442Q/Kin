import { useContext } from 'react'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'

/**
 * Сколько места снизу занимает плавающая панель вкладок (0 вне вкладок). Кнопка, прижатая к низу экрана
 * через position: absolute, должна подняться на эту высоту: Screen отдаёт панели место отступом контейнера, а
 * абсолютные элементы отступ не учитывают, и кнопка оказывалась ПОД панелью («Задать ДЗ», «Сохранить»).
 */
export function useTabBarSpace(): number {
  return useContext(BottomTabBarHeightContext) ?? 0
}
