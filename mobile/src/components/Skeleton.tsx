import { useEffect } from 'react'
import { Animated, DimensionValue, Easing, StyleProp, View, ViewStyle } from 'react-native'

import { uiText } from '../i18n/uiText'
import { colors } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'

/**
 * Один общий «пульс» на все заглушки экрана: десяток блоков не заводят десяток анимаций, а мигают синхронно.
 * Анимация идёт, пока на экране есть хотя бы одна заглушка.
 */
const pulse = new Animated.Value(0.55)
let users = 0
let loop: Animated.CompositeAnimation | null = null

function startPulse() {
  users += 1
  if (users > 1) return
  loop = Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.55, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]),
  )
  loop.start()
}

function stopPulse() {
  users = Math.max(0, users - 1)
  if (users === 0) {
    loop?.stop()
    loop = null
  }
}

interface SkeletonProps {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

/** Серый мигающий блок на месте данных, которые ещё грузятся. */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  useEffect(() => {
    startPulse()
    return stopPulse
  }, [])
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.border, opacity: pulse }, style]}
    />
  )
}

/** Строка списка: значок слева и две строки текста. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={34} height={34} radius={11} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="62%" height={13} />
        <Skeleton width="38%" height={11} />
      </View>
    </View>
  )
}

/** Несколько строк списка (оповещения, чат, расписание). */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View
      style={{ gap: 14 }}
      accessibilityRole="progressbar"
      accessibilityLabel={uiText("Загрузка")}
    >
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  )
}

/**
 * Заглушка главной (кабинет учителя, родителя, ученика, директора): шапка, крупная карточка и список,
 * как на настоящем экране, чтобы страница не «прыгала», когда придут данные.
 */
export function HomeSkeleton({ hero = true }: { hero?: boolean }) {
  return (
    <View
      style={styles.home}
      accessibilityRole="progressbar"
      accessibilityLabel={uiText("Загрузка")}
    >
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="38%" height={12} />
          <Skeleton width="64%" height={26} radius={10} />
        </View>
        <Skeleton width={44} height={44} radius={22} />
        <Skeleton width={44} height={44} radius={22} />
      </View>
      {hero ? <Skeleton height={176} radius={26} /> : null}
      <View style={styles.card}>
        <Skeleton width="42%" height={16} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    </View>
  )
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  home: { padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: {
    padding: 16,
    borderRadius: 24,
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
}))
