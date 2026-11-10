import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { getScheme } from '../theme/colors'

interface Props {
  /**
   * home и inner — экраны кабинетов: персиковое небо и мягкое «солнечное» пятно в правом верхнем углу (как в макете).
   * scenic — заставка и вход: то же небо, но ещё и горы внизу.
   */
  variant?: 'home' | 'inner' | 'scenic'
}

/** Небо макета (180°): сверху светлее, к низу персиковее. */
const SKY: [string, string][] = [
  ['0', '#FFF7F2'],
  ['0.5', '#FFE9DE'],
  ['1', '#FFD5C2'],
]

/** Ночное небо для тёмной темы: глубокий бирюзовый, к низу темнее. */
const SKY_DARK: [string, string][] = [
  ['0', '#14494B'],
  ['0.45', '#0A2A2C'],
  ['1', '#071A1C'],
]
/** Звёзды: [x, y, радиус] в координатах viewBox. */
const STARS: [number, number, number][] = [
  [60, 120, 1.6], [200, 60, 1.2], [300, 220, 1.6], [120, 250, 1.2], [350, 90, 1.4], [30, 300, 1.2], [260, 40, 1.4],
]

/**
 * Фон экранов: рисуется векторно одним SVG на весь экран, не перехватывает касания. Размеры взяты из макета
 * (390×844): небо, пятно света справа сверху (круг 230 px с центром в 365, 55) и, на заставке и входе, горы внизу.
 */
function Backdrop({ variant = 'home' }: Props) {
  const scenic = variant === 'scenic'
  const dark = getScheme() === 'dark'
  const sky = dark ? SKY_DARK : SKY
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            {sky.map(([offset, color]) => (
              <Stop key={offset} offset={offset} stopColor={color} />
            ))}
          </LinearGradient>
          {/* угловое свечение: radial-gradient(90% 45% at 100% 0%, #FFD2BD, прозрачный 70%) */}
          <RadialGradient id="corner" cx="390" cy="0" rx="351" ry="380" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={dark ? '#F6E7D3' : '#FFD2BD'} stopOpacity={dark ? 0.12 : 1} />
            <Stop offset="0.7" stopColor={dark ? '#F6E7D3' : '#FFD2BD'} stopOpacity="0" />
          </RadialGradient>
          {/* пятно света: центр светлее, к краю прозрачное (радиальный градиент макета со смещённым центром) */}
          <RadialGradient id="glow" cx="0.4" cy="0.4" r="0.72">
            <Stop offset="0" stopColor={dark ? '#F6E7D3' : '#FFB08F'} stopOpacity={dark ? 0.32 : 1} />
            <Stop offset="0.45" stopColor={dark ? '#F6E7D3' : '#FF8A65'} stopOpacity={dark ? 0.14 : 0.45} />
            <Stop offset="1" stopColor={dark ? '#F6E7D3' : '#FF8A65'} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="844" fill="url(#sky)" />
        <Rect width="390" height="844" fill="url(#corner)" />
        {scenic ? (
          <Circle cx="340" cy="160" r="120" fill="url(#glow)" />
        ) : (
          <Circle cx="365" cy="55" r="115" fill="url(#glow)" />
        )}
        {dark && STARS.map(([x, y, r], i) => <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity="0.85" />)}
        {scenic && (
          <>
            <Path
              d="M0 844 V766 L58 728 L104 754 L168 708 L228 750 L290 716 L350 748 L390 730 V844 Z"
              fill={dark ? '#0E3F41' : '#1BA6A0'}
              opacity={dark ? 0.9 : 0.32}
            />
            <Path
              d="M0 844 V796 L82 756 L150 786 L232 748 L312 790 L390 762 V844 Z"
              fill={dark ? '#082F31' : '#0D7A7C'}
              opacity={dark ? 0.95 : 0.42}
            />
          </>
        )}
      </Svg>
    </View>
  )
}

export default memo(Backdrop)
