import { localizeCopy, uiText } from '../i18n/uiText'
import { Pressable, View } from 'react-native'
import { Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native'

import { Text } from './Text'
import { colors, radius } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { useThemeStore, type ThemeMode } from '../theme/themeStore'

const OPTIONS: Array<{ mode: ThemeMode; label: string; Icon: LucideIcon }> = localizeCopy([
  { mode: 'light', label: 'Светлая', Icon: Sun },
  { mode: 'dark', label: 'Тёмная', Icon: Moon },
  { mode: 'system', label: 'Как в системе', Icon: Smartphone },
])

/**
 * Переключатель темы оформления: светлая, тёмная или как в телефоне.
 * Выбор запоминается. При смене приложение перерисовывается целиком и остаётся на этом же экране.
 */
export default function ThemeSwitch() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={uiText("Тема оформления")}>
      {OPTIONS.map(({ mode: m, label, Icon }) => {
        const on = mode === m
        return (
          <Pressable
            key={m}
            onPress={() => void setMode(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <Icon size={20} color={on ? colors.onPrimary : colors.textMid} strokeWidth={2.2} />
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  labelOn: { color: colors.onPrimary },
}))
