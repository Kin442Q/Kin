import { uiLanguage, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { App as AntdApp, Avatar, Button, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { MessageOutlined, CheckOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  homeworkStatusApi,
  STATUS_COLOR,
  STATUS_LABEL,
  type HomeworkRoster,
  type NoticeTemplate,
  type RosterRow,
  type StaffStatus,
} from '../api/schoolApi'

const { Text } = Typography

interface Props {
  homeworkId: string | null
  onClose: () => void
}

const STAFF_OPTIONS: Array<{ value: StaffStatus; label: string }> = [
  { value: 'DONE', get label() { return uiText("Выполнено") } },
  { value: 'PARTIAL', get label() { return uiText("Частично") } },
  { value: 'NOT_DONE', get label() { return uiText("Не выполнено") } },
]

type TemplateChoice = 'auto' | NoticeTemplate

const TEMPLATE_OPTIONS: Array<{ value: TemplateChoice; label: string }> = [
  { value: 'auto', get label() { return uiText("По статусу каждого ученика (рекомендуется)") } },
  { value: 'NOT_DONE', get label() { return uiText("«Не выполнил(а) домашнее задание»") } },
  { value: 'PARTIAL', get label() { return uiText("«Выполнил(а) не полностью»") } },
  { value: 'REMINDER', get label() { return uiText("«Напоминаем о сроке сдачи»") } },
]

/**
 * Статусы ДЗ по ученикам класса: учитель отмечает выполнение, видит
 * самоотметки учеников и пишет родителям одним нажатием.
 */
export default function HomeworkStatusModal({ homeworkId, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [roster, setRoster] = useState<HomeworkRoster | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const [notifyOpen, setNotifyOpen] = useState(false)
  const [template, setTemplate] = useState<TemplateChoice>('auto')
  const [note, setNote] = useState('')
  const [notifying, setNotifying] = useState(false)

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  const load = useCallback(async () => {
    if (!homeworkId) return
    setLoading(true)
    try {
      setRoster(await homeworkStatusApi.roster(homeworkId))
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось загрузить статусы")))
    } finally {
      setLoading(false)
    }
  }, [homeworkId, message])

  useEffect(() => {
    setRoster(null)
    setSelected([])
    if (homeworkId) load()
  }, [homeworkId, load])

  const save = async (items: Array<{ studentId: string; status: StaffStatus | null; comment?: string }>) => {
    if (!homeworkId) return
    setSaving(true)
    try {
      setRoster(await homeworkStatusApi.setStatuses(homeworkId, items))
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось сохранить")))
    } finally {
      setSaving(false)
    }
  }

  const unmarked = useMemo(
    () => (roster?.students ?? []).filter((r) => r.status === null || r.status === 'SUBMITTED'),
    [roster, uiLanguage()],
  )

  const markAllDone = () =>
    save(unmarked.map((r) => ({ studentId: r.student.id, status: 'DONE' as const })))

  const notifyTargets = (roster?.students ?? []).filter((r) => selected.includes(r.student.id))

  const sendNotice = async () => {
    if (!homeworkId || notifyTargets.length === 0) return
    setNotifying(true)
    try {
      const r = await homeworkStatusApi.notifyParents(homeworkId, {
        studentIds: notifyTargets.map((t) => t.student.id),
        template: template === 'auto' ? undefined : template,
        note: note.trim() || undefined,
      })
      const noParents = r.skipped.length
      message.success(
        uiText("Сообщение отправлено: {0} из {1} учеников", r.notified, notifyTargets.length) +
          (noParents ? uiText(". У {0} нет родителей в системе", noParents) : ''),
      )
      setNotifyOpen(false)
      setNote('')
      setSelected([])
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось отправить")))
    } finally {
      setNotifying(false)
    }
  }

  const hw = roster?.homework
  const s = roster?.summary

  return (
    <>
      <Modal
        open={!!homeworkId}
        onCancel={onClose}
        footer={<Button onClick={onClose}>{uiText("Закрыть")}</Button>}
        width={820}
        destroyOnClose
        title={
          hw ? (
            <div>
              <div>
                {" " + uiText("Статусы:") + " "}{hw.subject.name} · {hw.group.name}
              </div>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                «{hw.title}{uiText("» · срок") + " "}{dayjs(hw.dueDate).format('DD.MM.YYYY')}
              </Text>
            </div>
          ) : (
            uiText("Статусы ДЗ")
          )
        }
      >
        {s && (
          <Space size={[6, 6]} wrap style={{ marginBottom: 12 }}>
            <Tag color="green">{uiText("выполнено") + " "}{s.done}</Tag>
            <Tag color="orange">{uiText("частично") + " "}{s.partial}</Tag>
            <Tag color="red">{uiText("не выполнено") + " "}{s.notDone}</Tag>
            <Tag color="blue">{uiText("ученик отметил «сделал»") + " "}{s.submitted}</Tag>
            <Tag>{uiText("не отмечено") + " "}{s.unmarked}</Tag>
          </Space>
        )}

        <Space style={{ marginBottom: 12 }} wrap>
          <Button
            icon={<CheckOutlined />}
            disabled={unmarked.length === 0 || saving}
            onClick={markAllDone}
          >
            {" " + uiText("Всем неотмеченным: выполнено (")}{unmarked.length})
          </Button>
          <Button
            type="primary"
            icon={<MessageOutlined />}
            disabled={selected.length === 0}
            onClick={() => setNotifyOpen(true)}
          >
            {" " + uiText("Сообщить родителям (")}{selected.length})
          </Button>
        </Space>

        <Table<RosterRow>
          rowKey={(r) => r.student.id}
          size="small"
          loading={loading || saving}
          dataSource={roster?.students ?? []}
          pagination={false}
          scroll={{ y: 420 }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as string[]),
          }}
          columns={[
            {
              title: uiText("Ученик"),
              key: 'student',
              render: (_, r) => (
                <Space>
                  <Avatar size={28} src={r.student.photoUrl || undefined}>
                    {r.student.firstName.slice(0, 1)}
                  </Avatar>
                  <span>
                    {r.student.lastName} {r.student.firstName}
                  </span>
                </Space>
              ),
            },
            {
              title: uiText("Статус"),
              key: 'status',
              width: 230,
              render: (_, r) => (
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  {r.status === 'SUBMITTED' && (
                    <Tag color={STATUS_COLOR.SUBMITTED} style={{ margin: 0 }}>
                      {STATUS_LABEL.SUBMITTED}
                    </Tag>
                  )}
                  <Select
                    size="small"
                    allowClear
                    style={{ width: '100%' }}
                    placeholder={r.status === 'SUBMITTED' ? uiText("Проверить…") : uiText("Не отмечено")}
                    value={r.status === 'SUBMITTED' ? undefined : (r.status ?? undefined)}
                    options={STAFF_OPTIONS}
                    onChange={(v) => save([{ studentId: r.student.id, status: (v as StaffStatus) ?? null }])}
                    onClear={() => save([{ studentId: r.student.id, status: null }])}
                  />
                </Space>
              ),
            },
            {
              title: uiText("Комментарий"),
              key: 'comment',
              render: (_, r) => (
                <Input
                  size="small"
                  key={`${r.student.id}-${r.markedAt ?? ''}`}
                  defaultValue={r.comment ?? ''}
                  maxLength={500}
                  placeholder={r.status && r.status !== 'SUBMITTED' ? uiText("Заметка…") : '—'}
                  disabled={!r.status || r.status === 'SUBMITTED'}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (r.comment ?? '') && r.status && r.status !== 'SUBMITTED') {
                      save([{ studentId: r.student.id, status: r.status, comment: v }])
                    }
                  }}
                />
              ),
            },
            {
              title: uiText("Родители"),
              key: 'parents',
              width: 90,
              align: 'center',
              render: (_, r) =>
                r.parentsCount > 0 ? (
                  <Tag color="green">{r.parentsCount}</Tag>
                ) : (
                  <Tag color="default">{uiText("нет")}</Tag>
                ),
            },
          ]}
        />
      </Modal>

      <Modal
        open={notifyOpen}
        onCancel={() => setNotifyOpen(false)}
        onOk={sendNotice}
        okText={uiText("Отправить")}
        cancelText={uiText("Отмена")}
        confirmLoading={notifying}
        title={uiText("Сообщить родителям: {0} уч.", notifyTargets.length)}
        destroyOnClose
      >
        <p style={{ marginTop: 0 }}>
          {" " + uiText("Родители получат сообщение (в чате и пуш-уведомлением) от вашего имени. Текст формируется автоматически: имя ребёнка, предмет, задание и срок.") + " "}</p>
        <Text strong>{uiText("Шаблон")}</Text>
        <Select
          style={{ width: '100%', margin: '4px 0 12px' }}
          value={template}
          onChange={setTemplate}
          options={TEMPLATE_OPTIONS}
        />
        <Text strong>{uiText("Комментарий учителя (необязательно)")}</Text>
        <Input.TextArea
          style={{ marginTop: 4 }}
          rows={3}
          maxLength={500}
          showCount
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={uiText("Например: нужно сдать до пятницы")}
        />
        {notifyTargets.some((t) => t.parentsCount === 0) && (
          <p style={{ marginTop: 12, color: '#d48806' }}>
            {" " + uiText("У некоторых выбранных учеников нет родителей в системе — им сообщение не уйдёт.") + " "}</p>
        )}
      </Modal>
    </>
  )
}
