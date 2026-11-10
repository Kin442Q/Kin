import { ReactNode, useRef } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

interface Props {
  /** Цвет слева сверху и справа снизу. */
  from: string
  to: string
  /** Средний цвет и его положение от 0 до 1 (по умолчанию 0.5), если градиент из трёх цветов. */
  via?: string
  viaAt?: number
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

let counter = 0

/** `rgba(r,g,b,a)` → цвет и прозрачность отдельно: SVG-градиент на Android игнорирует альфа-канал внутри stopColor. */
function splitColor(color: string): { color: string; opacity: number } {
  const m = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/)
  return m ? { color: `rgb(${m[1]},${m[2]},${m[3]})`, opacity: Number(m[4]) } : { color, opacity: 1 }
}

/**
 * Блок с диагональным градиентом: фон рисуется векторно (react-native-svg), отдельная библиотека градиентов не
 * нужна. Скругление и размеры задаются в `style`; содержимое лежит поверх градиента.
 */
export default function GradientView({ from, to, via, viaAt = 0.5, style, children }: Props) {
  // Идентификатор градиента должен быть уникальным на экране: иначе блоки возьмут цвета друг друга
  const id = useRef(`grad${(counter += 1)}`).current
  const stops: [number, string][] = via ? [[0, from], [viaAt, via], [1, to]] : [[0, from], [1, to]]
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {stops.map(([offset, raw]) => {
              const { color, opacity } = splitColor(raw)
              return <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
            })}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  )
}
