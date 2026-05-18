import { ReactNode } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { colors, radius, shadow } from '../theme/colors'

interface Props {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Поднимающаяся тень (default md) */
  elevation?: 'none' | 'sm' | 'md' | 'lg'
  padding?: number
}

export default function Card({
  children,
  style,
  elevation = 'md',
  padding = 16,
}: Props) {
  return (
    <View
      style={[
        styles.card,
        { padding },
        elevation !== 'none' && shadow[elevation],
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
})
