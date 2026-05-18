import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'

interface Props {
  name: string
  size?: number
}

const palettes: Array<[string, string]> = [
  [colors.primarySoft, colors.primaryDeep],
  [colors.blueSoft, colors.blueDeep],
  [colors.yellowSoft, colors.yellowDeep],
  [colors.lilacSoft, colors.lilacDeep],
]

/** Sprout-аватар: квадрат с закруглением 1/3 + инициалы. */
export default function Avatar({ name, size = 40 }: Props) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const idx = name.charCodeAt(0) % palettes.length
  const [bg, fg] = palettes[idx]
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: bg,
        },
      ]}
    >
      <Text
        style={{
          color: fg,
          fontWeight: '700',
          fontSize: size * 0.38,
          letterSpacing: -0.3,
        }}
      >
        {initials}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
