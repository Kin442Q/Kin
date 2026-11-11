import { uiText } from '../../i18n/uiText'
import { useState } from 'react'
import { App as AntdApp, Button, Tag, Typography } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import dayjs from 'dayjs'

import { SP } from '../sprout'
import {
  studentApi,
  STATUS_COLOR,
  STATUS_LABEL,
  type StudentHomework,
  type SubmissionStatus,
} from '../../api/schoolApi'

const { Text } = Typography

interface Props {
  hw: StudentHomework
  /** Вызывается после успешной отметки — с новым статусом (null — снята). */
  onChange: (id: string, status: SubmissionStatus | null) => void
}

/**
 * ДЗ глазами ученика: что задано, к какому сроку и кнопка «Я сделал».
 * Вердикт учителя (выполнено / частично / не выполнено) ученик не меняет.
 */
export default function StudentHomeworkCard({ hw, onChange }: Props) {
  const { message } = AntdApp.useApp()
  const [busy, setBusy] = useState(false)

  const status = hw.submission?.status ?? null
  const verdict = status && status !== 'SUBMITTED' ? status : null
  const submitted = status === 'SUBMITTED'
  const due = dayjs(hw.dueDate)
  const overdue = due.endOf('day').isBefore(dayjs()) && !status

  const toggle = async () => {
    setBusy(true)
    try {
      const r = await studentApi.setSubmitted(hw.id, !submitted)
      onChange(hw.id, r.status)
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось отметить"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 14,
        background: SP.surface,
        border: `1px solid ${SP.borderSoft}`,
        opacity: overdue ? 0.75 : 1,
      }}
    >
      <div
        style={{
          width: 54,
          padding: '6px 2px',
          borderRadius: 12,
          textAlign: 'center',
          background: `${hw.subject.color}22`,
          color: hw.subject.color,
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.1 }}>{due.format('DD')}</div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{due.format('MMM')}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tag style={{ background: hw.subject.color, color: '#fff', border: 'none', fontWeight: 700 }}>
            {hw.subject.name}
          </Tag>
          {overdue && <Tag color="red">{uiText("срок прошёл")}</Tag>}
          {verdict && <Tag color={STATUS_COLOR[verdict]}>{STATUS_LABEL[verdict]}</Tag>}
          {submitted && <Tag color={STATUS_COLOR.SUBMITTED}>{uiText("Ждёт проверки учителя")}</Tag>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{hw.title}</div>
        {hw.description && (
          <Text type="secondary" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
            {hw.description}
          </Text>
        )}
        {hw.submission?.comment && verdict && (
          <Text style={{ display: 'block', fontSize: 13, marginTop: 4, color: SP.textMid }}>
            {" " + uiText("Учитель:") + " "}{hw.submission.comment}
          </Text>
        )}
      </div>

      {!verdict && (
        <Button
          type={submitted ? 'default' : 'primary'}
          icon={submitted ? <CheckCircleFilled style={{ color: SP.primary }} /> : undefined}
          loading={busy}
          onClick={toggle}
        >
          {submitted ? uiText("Я сделал(а) ✓") : uiText("Я сделал(а)")}
        </Button>
      )}
    </div>
  )
}
