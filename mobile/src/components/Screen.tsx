import { ReactNode } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../theme/colors'

interface Props {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Если true — без SafeAreaView (для модалок/bottom sheets) */
  noSafe?: boolean
  /** Цвет фона. По умолчанию — Sprout cream. */
  bg?: string
}

/** Обёртка экрана с SafeArea + Sprout-фоном по умолчанию. */
export default function Screen({ children, style, noSafe, bg }: Props) {
  const Container = noSafe ? View : SafeAreaView
  return (
    <Container
      style={[styles.root, { backgroundColor: bg ?? colors.bg }, style]}
    >
      {children}
    </Container>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
