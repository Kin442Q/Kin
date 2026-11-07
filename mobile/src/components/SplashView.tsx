import { useEffect, useRef } from 'react'
import { Animated, Easing, Text as RNText, View } from 'react-native'

import Screen from './Screen'
import { BrandMark } from './Logo'
import { colors } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'

/** Три точки, которые мягко «дышат» по очереди. */
function LoadingDots() {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current

  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [values])

  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Загрузка">
      {values.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v }]} />
      ))}
    </View>
  )
}

/**
 * Заставка при запуске: знак, название и подпись на закате с горами (как в макете). Показывается, пока приложение
 * поднимает шрифты, сохранённую сессию и тему. Шрифты ещё могут не быть загружены, поэтому текст здесь системный.
 */
export default function SplashView() {
  return (
    <Screen variant="home">
      <View style={styles.center}>
        <BrandMark width={120} />
        <RNText style={styles.word}>
          мактаби<RNText style={styles.man}>ман</RNText>
        </RNText>
        <RNText style={styles.tagline}>Школа в вашем телефоне</RNText>
      </View>
      <View style={styles.bottom}>
        <LoadingDots />
        <RNText style={styles.footer}>Для государственных школ Таджикистана</RNText>
      </View>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  word: { fontSize: 38, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  man: { color: colors.primary },
  tagline: { fontSize: 16, fontWeight: '600', color: colors.textMid },
  bottom: { alignItems: 'center', gap: 16, paddingBottom: 56 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  footer: { fontSize: 12, fontWeight: '600', color: colors.textMid },
}))
