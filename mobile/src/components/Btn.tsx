import { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { colors, radius, font } from '../theme/colors'

interface Props {
  children: ReactNode
  onPress?: () => void
  /** primary = мятная заливка, secondary = surfaceAlt, danger = красная */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  disabled?: boolean
  icon?: ReactNode
  /** Растянуть на всю ширину родителя */
  block?: boolean
  size?: 'sm' | 'md' | 'lg'
  style?: StyleProp<ViewStyle>
}

export default function Btn({
  children,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  block,
  size = 'md',
  style,
}: Props) {
  const isDisabled = disabled || loading

  const bg = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    danger: colors.danger,
    ghost: 'transparent',
  }[variant]

  const fg = {
    primary: '#fff',
    secondary: colors.text,
    danger: '#fff',
    ghost: colors.primaryDeep,
  }[variant]

  const sizes = {
    sm: { padV: 8, padH: 14, font: font.size.sm, minH: 36 },
    md: { padV: 12, padH: 18, font: font.size.base, minH: 44 },
    lg: { padV: 16, padH: 22, font: font.size.md, minH: 56 },
  }[size]

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          paddingVertical: sizes.padV,
          paddingHorizontal: sizes.padH,
          minHeight: sizes.minH,
          alignSelf: block ? 'stretch' : 'auto',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: pressed ? [{ scale: 0.97 }] : undefined,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                { color: fg, fontSize: sizes.font, marginLeft: icon ? 8 : 0 },
              ]}
            >
              {children}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: -0.1,
  },
})
