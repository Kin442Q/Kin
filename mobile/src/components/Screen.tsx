import { ReactNode } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Backdrop from './Backdrop'
import { colors } from '../theme/colors'

interface Props {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Если true — без SafeAreaView (для модалок/bottom sheets) */
  noSafe?: boolean
  /** Свой сплошной цвет фона вместо «заката» */
  bg?: string
}

/** Обёртка экрана: фон «закат над горами» + SafeArea (учитывает вырезы и системные панели Android и iOS). */
export default function Screen({ children, style, noSafe, bg }: Props) {
  const Container = noSafe ? View : SafeAreaView
  return (
    <View style={[styles.root, { backgroundColor: bg ?? colors.bg }]}>
      {!bg && <Backdrop />}
      <Container style={[styles.fill, style]}>{children}</Container>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
})
