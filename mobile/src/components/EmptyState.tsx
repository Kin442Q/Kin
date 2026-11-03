import { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../theme/colors'

interface Props {
  icon?: ReactNode
  title: string
  hint?: string
}

/** Пустой список / ошибка загрузки: значок, заголовок и подсказка. */
export default function EmptyState({ icon, title, hint }: Props) {
  return (
    <View style={styles.wrap}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.textMid, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
})
