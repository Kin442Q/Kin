import { useContext, useEffect } from 'react'
import { Pressable, View } from 'react-native'
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs'
import type { LucideIcon } from 'lucide-react-native'

import { Text } from './Text'
import { colors } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'

export const TAB_BAR_HEIGHT = 76

/** Сколько места снизу занимает плавающая панель: сама панель + отступ от края + воздух над ней. */
export function floatingTabSpace(bottomInset: number): number {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, 10) + 6 + 10
}

interface Props extends BottomTabBarProps {
  /** Иконки вкладок по имени маршрута */
  icons: Record<string, LucideIcon>
}

/**
 * Нижняя панель-«таблетка» из макета: плавает над экраном с отступами по бокам.
 * Активная вкладка — бирюзовая «капсула» под иконкой, подпись жирнее. Цвета берутся из темы,
 * поэтому в тёмной теме панель тёмная. Высоту сообщает навигатору, поэтому экраны сами
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
              <View style={[styles.pill, focused && styles.pillOn]}>
                {Icon && (
                  <Icon
                    size={24}
                    color={focused ? colors.primaryDeep : colors.muted}
                    strokeWidth={focused ? 2.4 : 2}
                  />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, { color: focused ? colors.primaryDeep : colors.muted }, focused && styles.labelOn]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = themedStyles(() => ({
  wrap: { position: 'absolute', left: 12, right: 12 },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    borderRadius: 30,
    backgroundColor: colors.tabBar,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#10282A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 48 },
  // Капсула под иконкой: фиксированная высота и скругление, чтобы углы были круглыми на любом Android
  pill: {
    width: 62,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.primarySoft },
  label: { fontSize: 11.5, fontWeight: '600' },
  labelOn: { fontWeight: '800' },
}))
