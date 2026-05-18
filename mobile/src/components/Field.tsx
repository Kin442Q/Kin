import { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native'
import { colors, radius } from '../theme/colors'

interface InputProps extends TextInputProps {
  label: string
  hint?: string
}

export function Field({ label, hint, style, ...rest }: InputProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

interface SelectProps<T extends string> {
  label: string
  value: T | null
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  columns?: number
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 2,
}: SelectProps<T>) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.grid}>
        {options.map((o) => {
          const on = o.value === value
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[
                styles.chip,
                {
                  width: `${100 / columns - 2}%`,
                  backgroundColor: on ? colors.primary : colors.surfaceAlt,
                  borderColor: on ? colors.primary : colors.borderSoft,
                },
              ]}
            >
              <Text
                style={{
                  color: on ? '#fff' : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  hint: { fontSize: 11, color: colors.muted, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
})
