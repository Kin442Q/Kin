import { uiText } from '../i18n/uiText'
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import dayjs from 'dayjs'

import { Text } from './Text'
import Card from './Card'
import { colors, radius } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { gradeTone } from '../lib/gradeStyle'
import type { StudentTermReport } from '../api/termGrades'

/**
 * Итоги четвертей для ученика и родителя: по выбранной четверти — предмет и итог с пометкой,
 * поставил ли его учитель (залитый значок) или он расчётный (пунктирный). Без данных ничего не рисует.
 */
export default function TermGradesBlock({ report }: { report: StudentTermReport | null }) {
  const [picked, setPicked] = useState<string | null>(null)
  const terms = report?.terms ?? []
  // По умолчанию — самая поздняя четверть, где уже есть итоги.
  const term = terms.find((t) => t.id === picked) ?? terms[terms.length - 1]
  if (!report || !term) return null

  return (
    <Card padding={14} style={styles.card}>
      <Text style={styles.title}>{uiText('Итоги четвертей')}</Text>

      {terms.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {terms.map((t) => {
            const on = t.id === term.id
            return (
              <Pressable
                key={t.id}
                onPress={() => setPicked(t.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                hitSlop={6}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : (
        <Text style={styles.note}>{term.name}</Text>
      )}

      {term.subjects.map((row) => {
        const byTeacher = row.source === 'TEACHER'
        const tone = gradeTone(row.value, report.scaleMax)
        const note = byTeacher
          ? uiText('Поставил учитель · {0}', dayjs(row.date).format('DD.MM.YYYY'))
          : row.average !== null
            ? uiText('Расчётная · средний балл {0}, оценок: {1}', row.average, row.count)
            : uiText('Расчётная')
        return (
          <View
            key={row.subject.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${row.subject.name}. ${
              byTeacher
                ? uiText('Итог: {0}, поставил учитель', row.value)
                : uiText('Итог: {0}, расчётная', row.value)
            }`}
          >
            <View style={[styles.dot, { backgroundColor: row.subject.color }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.subject}>{row.subject.name}</Text>
              <Text style={styles.note}>
                {note}
                {!byTeacher && !term.finished ? ` · ${uiText('предварительно')}` : ''}
              </Text>
            </View>
            <View style={[styles.mark, byTeacher ? { backgroundColor: tone.bg } : styles.markCalculated]}>
              <Text style={[styles.markText, { color: byTeacher ? tone.fg : colors.text }]}>{row.value}</Text>
            </View>
          </View>
        )
      })}
    </Card>
  )
}

const styles = themedStyles(() => ({
  card: { gap: 10 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, color: colors.text },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipTextOn: { color: colors.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  subject: { fontSize: 15, fontWeight: '700', color: colors.text },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  mark: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  markCalculated: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary },
  markText: { fontSize: 18, fontWeight: '800' },
}))
