import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { getScheme } from '../theme/colors'

interface Props {
  /**
   * home — главные экраны: закат, солнце и горы внизу (как в макете «Кабинет»).
   * inner — внутренние экраны (список, журнал, расписание): мягкий тёплый градиент без гор,
   * чтобы не мешать плотному содержимому.
   */
  variant?: 'home' | 'inner'
}

/** Точки градиента неба: [позиция, цвет]. */
const SKY_HOME: [string, string][] = [
  ['0', '#FFF3EC'],
  ['0.4', '#FFD6C4'],
  ['0.72', '#FFB89E'],
  ['1', '#F49C80'],
]
const SKY_INNER: [string, string][] = [
  ['0', '#FFF3EC'],
  ['0.5', '#FFE2D5'],
  ['1', '#FFD0BD'],
]

/** Ночное небо для тёмной темы: глубокий бирюзовый, к низу темнее. */
const SKY_HOME_DARK: [string, string][] = [
  ['0', '#14494B'],
  ['0.45', '#0A2A2C'],
  ['1', '#071A1C'],
]
const SKY_INNER_DARK: [string, string][] = [
  ['0', '#0F3335'],
  ['0.5', '#0A2A2C'],
  ['1', '#071A1C'],
]
/** Звёзды: [x, y, радиус] в координатах viewBox. */
const STARS: [number, number, number][] = [
  [60, 120, 1.6], [200, 60, 1.2], [300, 220, 1.6], [120, 250, 1.2], [350, 90, 1.4], [30, 300, 1.2], [260, 40, 1.4],
]

/**
 * Фон экранов: закат над горами (как в вебе). Рисуется векторно одним SVG на весь экран,
 * не перехватывает касания. Одинаково выглядит на Android и iOS.
 */
function Backdrop({ variant = 'home' }: Props) {
  const home = variant === 'home'
  const dark = getScheme() === 'dark'
  const sky = dark ? (home ? SKY_HOME_DARK : SKY_INNER_DARK) : home ? SKY_HOME : SKY_INNER
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={home ? 'sky' : 'skyInner'} x1="0" y1="0" x2="0" y2="1">
            {sky.map(([offset, color]) => (
              <Stop key={offset} offset={offset} stopColor={color} />
            ))}
          </LinearGradient>
          <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={dark ? '#F6E7D3' : '#FF8A65'} stopOpacity={dark ? 0.35 : 0.55} />
            <Stop offset="1" stopColor={dark ? '#F6E7D3' : '#FF8A65'} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="800" fill={home ? 'url(#sky)' : 'url(#skyInner)'} />
        {home && (
          <>
            <Circle cx="318" cy="120" r="170" fill="url(#glow)" />
            <Circle cx="318" cy="120" r={dark ? 34 : 46} fill={dark ? '#F6E7D3' : '#FF8A65'} opacity={dark ? 0.95 : 0.8} />
            {dark && STARS.map(([x, y, r], i) => <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity="0.85" />)}
            <Path
              d="M0 800 V600 L55 545 L110 585 L175 525 L240 580 L300 535 L360 575 L400 540 V800 Z"
              fill={dark ? '#0E3F41' : '#1BA6A0'}
              opacity={dark ? 0.9 : 0.5}
            />
            <Path
              d="M0 800 V650 L70 600 L130 640 L210 585 L280 635 L340 600 L400 630 V800 Z"
              fill={dark ? '#082F31' : '#0D7A7C'}
              opacity={dark ? 0.95 : 0.55}
            />
          </>
        )}
      </Svg>
    </View>
  )
}

export default memo(Backdrop)
