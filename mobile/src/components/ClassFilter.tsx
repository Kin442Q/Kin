import { useMemo } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from './Text'
import { colors, radius } from '../theme/colors'
import { classLetterOf, gradeKeyOf, groupByGrade, type GradeKey } from '../lib/classes'

import { themedStyles } from '../theme/themedStyles'
export interface ClassItem {
  id: string
  name: string
}

/** Выбор в фильтре: параллель и (необязательно) конкретная буква. */
export interface ClassSelection {
  grade: GradeKey | null
  groupId: string | null
}

export const EMPTY_SELECTION: ClassSelection = { grade: null, groupId: null }

/** id классов, попавших под выбор: конкретный класс, вся параллель или ничего. */
export function selectedGroupIds(groups: ClassItem[], sel: ClassSelection): string[] {
  if (sel.groupId) return [sel.groupId]
  if (sel.grade !== null) return groups.filter((g) => gradeKeyOf(g.name) === sel.grade).map((g) => g.id)
  return []
}

interface Props {
  groups: ClassItem[]
  value: ClassSelection
  onChange: (next: ClassSelection) => void
  /** true — можно выбрать всю параллель («Все»), false — после параллели нужна буква */
  allowAllLetters?: boolean
  /** Сколько учеников в классе (мелкое число на плашке) */
  counts?: Record<string, number>
}

/**
 * Двухуровневый выбор класса для телефона: сначала параллель (1…11), затем буква (А, Б, В).
 * Две горизонтальные ленты вместо одного длинного списка всех классов.
 */
export default function ClassFilter({ groups, value, onChange, allowAllLetters = false, counts }: Props) {
  const grades = useMemo(() => groupByGrade(groups, (g) => g.name), [groups])
  const active = grades.find((g) => g.key === value.grade) ?? null

  const countOf = (ids: string[]) =>
    counts ? ids.reduce((sum, id) => sum + (counts[id] ?? 0), 0) : undefined

  const pickGrade = (key: GradeKey) => {
    if (value.grade === key) {
      onChange(EMPTY_SELECTION)
      return
    }
    const g = grades.find((x) => x.key === key)
    if (g && g.items.length === 1) onChange({ grade: key, groupId: g.items[0].id })
    else onChange({ grade: key, groupId: null })
  }

  if (groups.length === 0) return null

  const chip = (label: string, on: boolean, onPress: () => void, count?: number, key?: string) => (
    <Pressable
      key={key ?? label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        styles.chip,
        on && styles.chipOn,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      {count !== undefined && <Text style={[styles.chipCount, on && styles.chipTextOn]}>{count}</Text>}
    </Pressable>
  )

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Параллель</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {grades.map((g) =>
          chip(
            g.key === 'other' ? 'Другие' : String(g.grade),
            value.grade === g.key,
            () => pickGrade(g.key),
            countOf(g.items.map((i) => i.id)),
            String(g.key),
          ),
        )}
      </ScrollView>

      {active && active.items.length > 1 && (
        <>
          <Text style={styles.label}>Класс</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {allowAllLetters &&
              chip('Все', value.groupId === null, () => onChange({ grade: active.key, groupId: null }), undefined, 'all')}
            {active.items.map((g) =>
              chip(
                classLetterOf(g.name),
                value.groupId === g.id,
                () => onChange({ grade: active.key, groupId: g.id }),
                countOf([g.id]),
                g.id,
              ),
            )}
          </ScrollView>
        </>
      )}
    </View>
  )
}

const styles = themedStyles(() => ({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: { gap: 6, paddingRight: 8 },
  chip: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.text },
  chipTextOn: { color: '#fff' },
  chipCount: { fontSize: 11, fontWeight: '600', color: colors.muted },
}))
