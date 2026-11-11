import { ReactNode } from 'react'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'

import { Text } from './Text'
import Card from './Card'
import { colors, radius } from '../theme/colors'

import { themedStyles } from '../theme/themedStyles'
/** Тёплый коричневый для строки-подписи над заголовком (из макета). */
export const EYEBROW = '#4A2A20'

interface HeadingProps {
  /** Строка над заголовком: дата, класс, предмет */
  eyebrow?: string
  title: string
  /** Элемент справа (аватар, кнопка) */
  right?: ReactNode
  size?: number
}

/** Заголовок экрана из макета: мелкая подпись сверху и крупный Montserrat. */
export function ScreenHeading({ eyebrow, title, right, size = 26 }: HeadingProps) {
  return (
    <View style={styles.headingRow}>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { fontSize: size }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  )
}

interface TileProps {
  label: string
  value: string | number
  hint?: string
  /** glass — стеклянная плитка; teal — бирюзовая, главный показатель */
  tone?: 'glass' | 'teal'
  style?: StyleProp<ViewStyle>
}

/** Плитка-показатель: подпись, крупное число, пояснение. */
export function Tile({ label, value, hint, tone = 'glass', style }: TileProps) {
  const teal = tone === 'teal'
  return (
    <Card
      padding={14}
      elevation="none"
      style={[styles.tile, teal && { backgroundColor: colors.primary, borderColor: colors.primary }, style]}
    >
      <Text style={[styles.tileLabel, teal && { color: '#BDEBE8' }]}>{label}</Text>
      <Text style={[styles.tileValue, teal && { color: '#FFFFFF' }]}>{value}</Text>
      {hint ? <Text style={[styles.tileHint, teal && { color: '#DDF1F0' }]}>{hint}</Text> : null}
    </Card>
  )
}

interface ChipProps {
  label: string
  /** solid — бирюзовый; glass — светлый; coral — коралловый (внимание) */
  tone?: 'solid' | 'glass' | 'coral'
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/** Чип-«таблетка»: фильтр, счётчик, тег. */
export function Chip({ label, tone = 'glass', onPress, style }: ChipProps) {
  const bg = tone === 'solid' ? colors.primary : tone === 'coral' ? colors.roseSoft : colors.surface
  const fg = tone === 'solid' ? colors.onPrimary : tone === 'coral' ? colors.roseDeep : colors.text
  const body = (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  )
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {body}
    </Pressable>
  ) : (
    body
  )
}

/** Заголовок раздела внутри карточки: «Уроки сегодня» + справа короткая подпись. */
export function CardTitle({ title, right, rightTone = 'muted' }: { title: string; right?: string; rightTone?: 'muted' | 'warn' }) {
  return (
    <View style={styles.cardTitleRow}>
      <Text style={styles.cardTitle}>{title}</Text>
      {right ? (
        <Text style={[styles.cardTitleRight, rightTone === 'warn' && { color: colors.roseDeep, fontWeight: '700' }]}>{right}</Text>
      ) : null}
    </View>
  )
}

const styles = themedStyles(() => ({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 13, color: colors.textMid },
  title: { fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tile: { gap: 2 },
  tileLabel: { fontSize: 12, color: colors.textMid },
  tileValue: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tileHint: { fontSize: 12, color: colors.primaryDeep, fontWeight: '600' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  chipText: { fontSize: 12, fontWeight: '700' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardTitleRight: { fontSize: 13, color: colors.textMid },
}))
