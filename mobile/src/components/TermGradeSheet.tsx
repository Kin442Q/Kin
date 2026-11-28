import { uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import dayjs from 'dayjs'
import { Calculator } from 'lucide-react-native'

import { Text } from './Text'
import BottomModal from './BottomModal'
import Btn from './Btn'
import { colors, radius } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { notify, notifyError } from '../lib/notify'
import { termGradesApi, type TermGradeItem, type TermGradeKey } from '../api/termGrades'

interface Props {
  /** null — окно закрыто. */
  target: (TermGradeKey & { studentName: string; subjectName: string; termName: string }) | null
  item: TermGradeItem | null
  scaleMax: number
  onClose: () => void
  /** Сервер сохранил или сбросил итог: новое состояние ученика. */
  onSaved: (item: TermGradeItem) => void
}

/** Строка «что насчитала система» для учителя. */
function calculationText(item: TermGradeItem | null, scaleMax: number): string {
  const calc = item?.calculated
  if (!calc || calc.reason === 'NO_GRADES') return uiText('За эту четверть нет оценок — посчитать нечего.')
  if (calc.reason === 'OUT_OF_SCALE') {
    return uiText(
      'Посчитать нельзя: есть оценки выше шкалы школы (1–{0}). Возможно, у школы неверно указана шкала оценок — сообщите администратору.',
      scaleMax,
    )
  }
  return uiText('Расчёт системы: {0} (средний балл {1}, оценок: {2})', calc.value, calc.average, calc.count)
}

/**
 * Итог четверти одного ученика: поставить вручную, подставить расчёт, сбросить. В отличие от обычных
 * оценок нажатие на цифру ничего не сохраняет: итог записывается только кнопкой «Сохранить».
 */
export default function TermGradeSheet({ target, item, scaleMax, onClose, onSaved }: Props) {
  const [value, setValue] = useState<number | null>(null)
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null)
  const manual = item?.manual ?? null
  const calculated = item?.calculated.value ?? null

  // При открытии выбрана только уже поставленная учителем оценка: расчёт подставляется кнопкой.
  useEffect(() => {
    setValue(manual?.value ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.studentId, target?.termId, target?.subjectId])

  const run = async (action: 'save' | 'reset') => {
    if (!target) return
    if (action === 'save' && value === null) return
    const key: TermGradeKey = { termId: target.termId, subjectId: target.subjectId, studentId: target.studentId }
    setBusy(action)
    try {
      const res =
        action === 'save' ? await termGradesApi.set({ ...key, value: value! }) : await termGradesApi.reset(key)
      onSaved(res.item)
      onClose()
      notify.success(action === 'save' ? uiText('Итог четверти сохранён') : uiText('Оценка учителя сброшена'))
    } catch (e) {
      notifyError(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <BottomModal
      visible={!!target}
      onClose={onClose}
      title={target ? uiText('Итог четверти — {0}', target.studentName) : ''}
    >
      {target && (
        <>
          <Text style={styles.meta}>
            {target.subjectName} · {target.termName}
          </Text>

          <View style={styles.info}>
            <Text style={styles.infoText}>{calculationText(item, scaleMax)}</Text>
            {manual ? (
              <Text style={styles.current}>
                {uiText('Сейчас: {0} — поставил учитель', manual.value)}
                {manual.setBy ? ` ${manual.setBy.fullName}` : ''}, {dayjs(manual.setAt).format('DD.MM.YYYY')}
              </Text>
            ) : (
              <Text style={styles.meta}>
                {calculated !== null
                  ? uiText('Сейчас действует расчётная оценка. Она меняется вместе с оценками.')
                  : uiText('Итога пока нет.')}
              </Text>
            )}
          </View>

          <View style={styles.keys} accessibilityRole="radiogroup" accessibilityLabel={uiText('Итоговая оценка')}>
            {Array.from({ length: scaleMax }, (_, i) => i + 1).map((v) => {
              const on = value === v
              return (
                <Pressable
                  key={v}
                  onPress={() => setValue(v)}
                  disabled={!!busy}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={uiText('Оценка {0}', v)}
                  style={[styles.key, on && styles.keyOn]}
                >
                  <Text style={[styles.keyText, on && styles.keyTextOn]}>{v}</Text>
                </Pressable>
              )
            })}
          </View>

          <Btn
            variant="secondary"
            block
            icon={<Calculator size={18} color={colors.text} />}
            disabled={calculated === null || !!busy}
            onPress={() => setValue(calculated)}
          >
            {uiText('Посчитать автоматически')}
          </Btn>

          <Btn
            block
            loading={busy === 'save'}
            disabled={busy === 'reset' || value === null || value === manual?.value}
            onPress={() => run('save')}
          >
            {uiText('Сохранить')}
          </Btn>

          {manual && (
            <Btn variant="ghost" block loading={busy === 'reset'} disabled={busy === 'save'} onPress={() => run('reset')}>
              {uiText('Сбросить')}
            </Btn>
          )}

          <Text style={styles.hint}>
            {uiText('Оценка, которую вы сохраните, больше не меняется сама — пока вы её не измените или не сбросите.')}
          </Text>
        </>
      )}
    </BottomModal>
  )
}

const styles = themedStyles(() => ({
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  info: { gap: 6, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  infoText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  current: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  key: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.field,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  keyOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  keyText: { fontSize: 22, fontWeight: '800', color: colors.text },
  keyTextOn: { color: colors.onPrimary },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 17 },
}))
