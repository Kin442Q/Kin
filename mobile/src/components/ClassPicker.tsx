import { uiLanguage, uiText } from '../i18n/uiText'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from './Text'
import ClassFilter from './ClassFilter'
import { colors, radius } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { gradeKeyOf, type GradeKey } from '../lib/classes'

interface ClassItem {
  id: string
  name: string
}

interface Props {
  classes: ClassItem[]
  /** Выбранный класс; null — ещё не выбран, и экран ничего не показывает */
  value: string | null
  onChange: (id: string | null) => void
}

/** До скольких классов показываем одной лентой; больше — выбор «параллель → буква». */
const FLAT_LIMIT = 12

/**
 * Выбор класса, с которого начинается журнал и отметки. Показывает только классы учителя.
 * Выбранный класс подсвечен; нажатие по нему снова снимает выбор.
 */
export default function ClassPicker({ classes, value, onChange }: Props) {
  // Для длинного списка: параллель можно выбрать раньше буквы
  const [grade, setGrade] = useState<GradeKey | null>(null)
  const selectedName = useMemo(() => classes.find((c) => c.id === value)?.name, [classes, value, uiLanguage()])

  if (classes.length > FLAT_LIMIT) {
    return (
      <ClassFilter
        groups={classes}
        value={{ grade: selectedName ? gradeKeyOf(selectedName) : grade, groupId: value }}
        onChange={(sel) => {
          setGrade(sel.grade)
          onChange(sel.groupId)
        }}
      />
    )
  }

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={uiText("Класс")}>
      {classes.map((c) => {
        const on = c.id === value
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(on ? null : c.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{c.name}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 56,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.field,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 15, fontWeight: '700', color: colors.text },
  textOn: { color: colors.onPrimary },
}))
