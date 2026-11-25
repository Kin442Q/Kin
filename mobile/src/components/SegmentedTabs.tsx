import { Pressable, View } from 'react-native'

import { Text } from './Text'
import { colors, getScheme } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'

export interface SegmentedTab<K extends string> {
  key: K
  label: string
  /** Число рядом с названием («Активные · 4»); 0 и undefined не показываются */
  count?: number
}

interface Props<K extends string> {
  tabs: SegmentedTab<K>[]
  value: K
  onChange: (key: K) => void
}

/**
 * Переключатель вкладок (домашние задания учителя и ученика): стеклянная подложка и выбранная вкладка-«плашка».
 * Все цвета берутся из палитры темы, поэтому подписи ВСЕХ вкладок читаются и в светлой, и в тёмной теме:
 * раньше подложка была жёстко белой, и в тёмной теме подписи невыбранных вкладок сливались с ней (виден был
 * только активный таб).
 *   светлая тема — выбранная вкладка белая, текст тёмный;
 *   тёмная тема  — выбранная вкладка бирюзовая, текст белый.
 */
export default function SegmentedTabs<K extends string>({ tabs, value, onChange }: Props<K>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.key === value
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.tab, on && styles.tabOn]}
          >
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
              {t.label}
              {t.count ? ` · ${t.count}` : ''}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = themedStyles(() => {
  const dark = getScheme() === 'dark'
  return {
    track: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    tab: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    tabOn: dark
      ? { backgroundColor: colors.primary }
      : {
          backgroundColor: colors.surfaceSolid,
          shadowColor: '#10282A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 2,
        },
    text: { fontSize: 13, fontWeight: '700', color: colors.textMid },
    textOn: { color: dark ? colors.onPrimary : colors.text, fontWeight: '800' },
  }
})
