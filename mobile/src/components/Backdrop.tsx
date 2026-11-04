import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

/**
 * Фон экранов: закат над горами (как в вебе). Рисуется векторно одним SVG на весь экран,
 * не перехватывает касания. Одинаково выглядит на Android и iOS.
 */
function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF3EC" />
            <Stop offset="0.4" stopColor="#FFD6C4" />
            <Stop offset="0.72" stopColor="#FFB89E" />
            <Stop offset="1" stopColor="#F49C80" />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FF8A65" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FF8A65" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="800" fill="url(#sky)" />
        <Circle cx="318" cy="120" r="170" fill="url(#glow)" />
        <Circle cx="318" cy="120" r="46" fill="#FF8A65" opacity="0.8" />
        <Path
          d="M0 800 V600 L55 545 L110 585 L175 525 L240 580 L300 535 L360 575 L400 540 V800 Z"
          fill="#1BA6A0"
          opacity="0.5"
        />
        <Path
          d="M0 800 V650 L70 600 L130 640 L210 585 L280 635 L340 600 L400 630 V800 Z"
          fill="#0D7A7C"
          opacity="0.55"
        />
      </Svg>
    </View>
  )
}

export default memo(Backdrop)
