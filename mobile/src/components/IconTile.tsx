import { StyleProp, View, ViewStyle } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

interface Props {
  icon: LucideIcon
  /** Цвет плитки (обычно мягкий, полупрозрачный) и цвет значка. */
  bg: string
  fg: string
  size?: number
  style?: StyleProp<ViewStyle>
}

/** Квадрат со скруглением и значком внутри: «иконка-плитка» карточек и строк из макета. */
export default function IconTile({ icon: Icon, bg, fg, size = 40, style }: Props) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon size={Math.round(size * 0.5)} color={fg} strokeWidth={2.1} />
    </View>
  )
}
