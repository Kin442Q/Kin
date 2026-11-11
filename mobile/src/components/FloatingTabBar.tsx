import { useContext, useEffect } from 'react'
import { Pressable, View } from 'react-native'
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs'
import type { LucideIcon } from 'lucide-react-native'

import { colors } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'

export const TAB_BAR_HEIGHT = 64

/** Сколько места снизу занимает плавающая панель: сама панель + отступ от края + воздух над ней. */
export function floatingTabSpace(bottomInset: number): number {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, 10) + 6 + 10
}

interface Props extends BottomTabBarProps {
  /** Иконки вкладок по имени маршрута */
  icons: Record<string, LucideIcon>
}

/**
 * Нижняя панель-«стеклянная капсула» из макета: плавает над экраном, только иконки без подписей.
 * Активная вкладка — бирюзовый круг с белой иконкой; название вкладки остаётся для озвучки (accessibilityLabel).
 * Цвета берутся из темы, поэтому в тёмной теме панель тёмная. Высоту сообщает навигатору, поэтому экраны сами
 * оставляют место под панелью.
 */
export default function FloatingTabBar({ state, descriptors, navigation, insets, icons }: Props) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext)
  const space = floatingTabSpace(insets.bottom)

  useEffect(() => {
    onHeightChange?.(space)
  }, [onHeightChange, space])

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]}
    >
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const label =
            typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name)
          const focused = state.index === index
          const Icon = icons[route.name]

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params)
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <View style={[styles.circle, focused && styles.circleOn]}>
                {Icon && (
                  <Icon
                    size={focused ? 24 : 25}
                    color={focused ? colors.onPrimary : colors.muted}
                    strokeWidth={focused ? 2.2 : 2}
                  />
                )}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = themedStyles(() => ({
  wrap: { position: 'absolute', left: 36, right: 36 },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: colors.tabBar,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#10282A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 12,
  },
  item: { alignItems: 'center', justifyContent: 'center' },
  // Круг под иконкой: фиксированный размер и радиус, чтобы он был круглым на любом Android
  circle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOn: {
    backgroundColor: colors.primary,
    shadowColor: '#075B5D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
}))
