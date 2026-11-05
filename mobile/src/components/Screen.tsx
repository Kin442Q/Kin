import { ReactNode, useContext } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import Backdrop from './Backdrop'
import { colors } from '../theme/colors'

import { themedStyles } from '../theme/themedStyles'
interface Props {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Если true — без SafeAreaView (для модалок/bottom sheets) */
  noSafe?: boolean
  /** Свой сплошной цвет фона вместо «заката» */
  bg?: string
  /** home — закат с горами (главные экраны); inner — мягкий градиент для внутренних экранов */
  variant?: 'home' | 'inner'
}

/**
 * Обёртка экрана: фон «закат над горами» + SafeArea (учитывает вырезы и системные панели Android и iOS).
 * Внутри вкладок нижняя панель плавает поверх экрана: ей отдаётся нужная высота снизу,
 * а фон продолжается под панелью (без полосы другого цвета).
 */
export default function Screen({ children, style, noSafe, bg, variant = 'inner' }: Props) {
  // Высоту плавающей панели вкладок сообщает сама панель (FloatingTabBar); вне вкладок — null.
  const tabBarHeight = useContext(BottomTabBarHeightContext)
  const inTabs = tabBarHeight != null
  const Container = noSafe ? View : SafeAreaView
  const safeProps = noSafe ? {} : { edges: inTabs ? (['top', 'left', 'right'] as const) : undefined }
  return (
    <View style={[styles.root, { backgroundColor: bg ?? colors.bg }]}>
      {!bg && <Backdrop variant={variant} />}
      <Container
        {...safeProps}
        style={[styles.fill, inTabs ? { paddingBottom: tabBarHeight } : null, style]}
      >
        {children}
      </Container>
    </View>
  )
}

const styles = themedStyles(() => ({
  root: { flex: 1 },
  fill: { flex: 1 },
}))
