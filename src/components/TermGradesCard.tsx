import { uiText } from '../i18n/uiText'
import { useState } from 'react'
import { Card, Segmented, Typography } from 'antd'
import dayjs from 'dayjs'

import { SP } from './sprout'
import type { StudentTermReport } from '../api/termGradesApi'

const { Text } = Typography

function markColor(value: number, scaleMax: number): string {
  const share = value / scaleMax
  if (share >= 0.9) return SP.primaryDeep
  if (share >= 0.7) return SP.primary
  if (share >= 0.5) return SP.yellowDeep
  return SP.danger
}

/**
 * Итоги четвертей для ученика и родителя: по выбранной четверти — предмет и итог с пометкой,
 * поставил ли его учитель или он расчётный. Без данных ничего не рисует.
 */
export default function TermGradesCard({ report }: { report: StudentTermReport | null }) {
  const [picked, setPicked] = useState<string | null>(null)
  const terms = report?.terms ?? []
  // По умолчанию — самая поздняя четверть, где уже есть итоги.
  const term = terms.find((t) => t.id === picked) ?? terms[terms.length - 1]
  if (!report || !term) return null

  return (
    <Card className="glass" bordered={false} title={uiText('Итоги четвертей')} style={{ marginBottom: 12 }}>
      {terms.length > 1 && (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <Segmented
            value={term.id}
            onChange={(v) => setPicked(String(v))}
            options={terms.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
      )}
      {terms.length === 1 && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {term.name}
        </Text>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {term.subjects.map((row) => {
          const byTeacher = row.source === 'TEACHER'
          const color = markColor(row.value, report.scaleMax)
          return (
            <div
              key={row.subject.id}
              data-testid="term-grade-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${SP.borderSoft}`,
                background: SP.surface,
              }}
            >
              <span
                style={{ width: 10, height: 10, borderRadius: 5, background: row.subject.color, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: SP.text }}>{row.subject.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {byTeacher
                    ? uiText('Поставил учитель · {0}', dayjs(row.date).format('DD.MM.YYYY'))
                    : row.average !== null
                      ? uiText('Расчётная · средний балл {0}, оценок: {1}', row.average, row.count)
                      : uiText('Расчётная')}
                  {!byTeacher && !term.finished ? ` · ${uiText('предварительно')}` : ''}
                </Text>
              </div>
              {/* Сплошной кружок — поставил учитель, пунктирный — расчётная */}
              <div
                aria-label={byTeacher ? uiText('Итог: {0}, поставил учитель', row.value) : uiText('Итог: {0}, расчётная', row.value)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 17,
                  flexShrink: 0,
                  background: byTeacher ? color : 'transparent',
                  color: byTeacher ? '#fff' : color,
                  border: byTeacher ? `2px solid ${color}` : `2px dashed ${color}`,
                }}
              >
                {row.value}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
