import { uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import { App as AntdApp, Button, InputNumber, Modal, Space, Typography } from 'antd'
import { Calculator } from 'lucide-react'
import dayjs from 'dayjs'

import { termGradesApi, type TermGradeItem, type TermGradeKey } from '../api/termGradesApi'

const { Text } = Typography

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
export function calculationText(item: TermGradeItem | null, scaleMax: number): string {
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
 * Итог четверти одного ученика: поставить вручную, подставить расчёт, сбросить.
 * Поставленная учителем оценка не меняется от новых оценок; «Сбросить» возвращает расчётную.
 */
export default function TermGradeModal({ target, item, scaleMax, onClose, onSaved }: Props) {
  const { message } = AntdApp.useApp()
  const [value, setValue] = useState<number | null>(null)
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null)
  const manual = item?.manual ?? null
  const calculated = item?.calculated.value ?? null

  // При открытии показываем только уже поставленную учителем оценку: расчёт подставляется кнопкой,
  // чтобы его нельзя было зафиксировать случайно, нажав «Сохранить».
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
      message.success(action === 'save' ? uiText('Итог четверти сохранён') : uiText('Оценка учителя сброшена'))
      onSaved(res.item)
      onClose()
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText('Ошибка'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={!!target}
      onCancel={onClose}
      destroyOnClose
      title={target ? uiText('Итог четверти — {0}', target.studentName) : ''}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          {manual ? (
            <Button danger loading={busy === 'reset'} disabled={busy === 'save'} onClick={() => run('reset')}>
              {uiText('Сбросить')}
            </Button>
          ) : (
            <span />
          )}
          <Space>
            <Button onClick={onClose}>{uiText('Отмена')}</Button>
            <Button
              type="primary"
              loading={busy === 'save'}
              disabled={busy === 'reset' || value === null || value === manual?.value}
              onClick={() => run('save')}
            >
              {uiText('Сохранить')}
            </Button>
          </Space>
        </Space>
      }
    >
      {target && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">
            {target.subjectName} · {target.termName}
          </Text>

          <div>
            <div>{calculationText(item, scaleMax)}</div>
            <div style={{ marginTop: 4 }}>
              {manual ? (
                <Text strong>
                  {uiText('Сейчас: {0} — поставил учитель', manual.value)}
                  {manual.setBy ? ` ${manual.setBy.fullName}` : ''}, {dayjs(manual.setAt).format('DD.MM.YYYY')}
                </Text>
              ) : calculated !== null ? (
                <Text type="secondary">
                  {uiText('Сейчас действует расчётная оценка. Она меняется вместе с оценками.')}
                </Text>
              ) : (
                <Text type="secondary">{uiText('Итога пока нет.')}</Text>
              )}
            </div>
          </div>

          <Space wrap>
            <InputNumber
              aria-label={uiText('Итоговая оценка')}
              placeholder={`1–${scaleMax}`}
              min={1}
              max={scaleMax}
              precision={0}
              value={value}
              onChange={(v) => setValue(typeof v === 'number' ? v : null)}
              style={{ width: 120 }}
            />
            <Button
              icon={<Calculator size={14} />}
              disabled={calculated === null}
              onClick={() => setValue(calculated)}
            >
              {uiText('Посчитать автоматически')}
            </Button>
          </Space>

          <Text type="secondary" style={{ fontSize: 12 }}>
            {uiText('Оценка, которую вы сохраните, больше не меняется сама — пока вы её не измените или не сбросите.')}
          </Text>
        </Space>
      )}
    </Modal>
  )
}
