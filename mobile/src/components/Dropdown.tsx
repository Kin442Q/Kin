import { useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ChevronDown, Check } from 'lucide-react-native'
import { colors, radius, shadow } from '../theme/colors'

export interface DropdownOption<T extends string> {
  value: T
  label: string
  /** Цветная точка слева (для предметов) */
  color?: string
}

interface Props<T extends string> {
  value: T | null
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
}

/**
 * Компактный дропдаун: кнопка с текущим значением + модальный список.
 * Подходит когда вариантов много (например 12 предметов) — в отличие от
 * чипов, не занимает много места.
 */
export default function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Выбрать',
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
      >
        {current?.color && (
          <View style={[styles.dot, { backgroundColor: current.color }]} />
        )}
        <Text
          style={[
            styles.triggerText,
            { color: current ? colors.text : colors.muted },
          ]}
          numberOfLines={1}
        >
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, shadow.lg]} onPress={(e) => e.stopPropagation()}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const on = item.value === value
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      (on || pressed) && { backgroundColor: colors.surfaceAlt },
                    ]}
                  >
                    {item.color && (
                      <View style={[styles.dot, { backgroundColor: item.color }]} />
                    )}
                    <Text
                      style={[
                        styles.optionText,
                        on && { color: colors.primaryDeep, fontWeight: '800' },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {on && <Check size={18} color={colors.primaryDeep} />}
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  triggerText: { flex: 1, fontSize: 15, fontWeight: '700' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,30,25,0.4)',
    justifyContent: 'center',
    padding: 28,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
})
