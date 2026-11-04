import { StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import { Text } from './Text'
import { colors } from '../theme/colors'

/** Знак «Офтоб»: солнце над раскрытой книгой (тот же, что в вебе). */
export function BrandMark({ width = 44, page2 = '#075B5D' }: { width?: number; page2?: string }) {
  return (
    <Svg width={width} height={Math.round((width * 100) / 120)} viewBox="0 0 120 100">
      <G stroke="#FF8A65" strokeWidth={5} strokeLinecap="round">
        <Path d="M60 6 V14" />
        <Path d="M30 18 L35 24" />
        <Path d="M90 18 L85 24" />
        <Path d="M20 44 H28" />
        <Path d="M100 44 H92" />
      </G>
      <Circle cx={60} cy={44} r={18} fill="#FF8A65" />
      <Path d="M8 52 Q34 44 60 60 V94 Q34 78 8 86 Z" fill="#0D7A7C" />
      <Path d="M112 52 Q86 44 60 60 V94 Q86 78 112 86 Z" fill={page2} />
    </Svg>
  )
}

/** Логотип «мактабиман»: знак + надпись («ма» тонко, «н» плотно, бирюзовым). */
export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Мактаби ман">
      <BrandMark width={Math.round(size * 2.3)} />
      <Text style={[styles.word, { fontSize: Math.round(size * 1.15) }]}>
        мактаби
        <Text style={[styles.man, { fontFamily: 'Montserrat_400Regular' }]}>ма</Text>
        <Text style={[styles.man, { fontFamily: 'Montserrat_800ExtraBold' }]}>н</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontFamily: 'Montserrat_800ExtraBold', color: colors.text, letterSpacing: -0.2 },
  man: { color: colors.primary },
})
