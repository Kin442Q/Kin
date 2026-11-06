import { useEffect, useMemo, useState } from 'react'
import { Alert, App as AntdApp, Button, Checkbox, Input, InputNumber, Modal, Select, Space, TimePicker, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import { http } from '../api'
import {
  DEFAULT_TEMPLATE,
  MAX_LESSONS,
  addMinutes,
  newKey,
  nextSlot,
  pickTeacher,
  rowsFromTemplate,
  sortTeachers,
  toPayload,
  validateRows,
  type LessonRow,
  type TeacherOption,
  type Template,
} from '../lib/scheduleBulk'

const { Text } = Typography

export const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const DAY_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export interface ExistingLesson {
  id: string
  groupId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  activity: string
  subjectId?: string | null
  teacherId?: string | null
  room?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Уроки добавлены: страница перечитывает расписание. */
  onSaved: () => void
  groups: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string; color: string }>
  teachers: TeacherOption[]
  /** Школа: у урока есть предмет, учитель и кабинет; иначе только название. */
  isSchool: boolean
  /** Уже внесённые уроки: для подсказок «уже есть» и копирования дня. */
  existing: ExistingLesson[]
  defaultGroupId?: string
  defaultDays?: number[]
}

const toTime = (v: string | null) => (v ? dayjs(v, 'HH:mm') : null)

/**
 * Добавление уроков сразу пачкой: выбираете класс и дни (можно все дни недели сразу), задаёте звонки
 * («6 уроков по 45 минут, перемена 10») и подписываете предметы — всё добавляется одним нажатием.
 * Учитель подставляется сам, если предмет и класс однозначно его. День можно скопировать из уже внесённого.
 */
export default function ScheduleBulkModal({
  open,
  onClose,
  onSaved,
  groups,
  subjects,
  teachers,
  isSchool,
  existing,
  defaultGroupId,
  defaultDays,
}: Props) {
  const { message } = AntdApp.useApp()
  const [groupId, setGroupId] = useState<string | undefined>(defaultGroupId)
  const [days, setDays] = useState<number[]>(defaultDays ?? [])
  const [tpl, setTpl] = useState<Template>(DEFAULT_TEMPLATE)
  const [rows, setRows] = useState<LessonRow[]>([])
  const [replace, setReplace] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // При каждом открытии начинаем с заготовки: шесть уроков по звонкам шаблона
  useEffect(() => {
    if (!open) return
    setGroupId(defaultGroupId)
    setDays(defaultDays ?? [])
    setTpl(DEFAULT_TEMPLATE)
    setRows(rowsFromTemplate(DEFAULT_TEMPLATE))
    setReplace(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const patchRow = (key: string, patch: Partial<LessonRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const setSubject = (key: string, subjectId: string | undefined) =>
    setRows((list) =>
      list.map((r) => {
        if (r.key !== key) return r
        // Учитель подставляется сам, только если у урока его ещё нет
        const teacherId = r.teacherId || pickTeacher(teachers, groupId, subjectId)
        return { ...r, subjectId, teacherId }
      }),
    )

  const setStart = (key: string, start: string | null) =>
    setRows((list) =>
      list.map((r) => {
        if (r.key !== key) return r
        // Конец подставляется по длительности урока, если его нет или он не позже начала
        const needEnd = start && (!r.end || r.end <= start)
        return { ...r, start, end: needEnd ? addMinutes(start!, tpl.lessonMin) : r.end }
      }),
    )

  const addRow = () => {
    if (rows.length >= MAX_LESSONS) return
    const slot = nextSlot(rows, tpl)
    setRows((list) => [...list, { key: newKey(), start: slot.start, end: slot.end }])
  }

  // Уроки, которые у выбранного класса уже есть в выбранные дни
  const clash = useMemo(
    () => existing.filter((e) => e.groupId === groupId && days.includes(e.dayOfWeek)),
    [existing, groupId, days],
  )

  // Дни, у которых у выбранного класса уже есть уроки: их можно скопировать
  const copyableDays = useMemo(
    () => Array.from(new Set(existing.filter((e) => e.groupId === groupId).map((e) => e.dayOfWeek))).sort((a, b) => a - b),
    [existing, groupId],
  )

  const copyFromDay = (day: number) => {
    const list = existing
      .filter((e) => e.groupId === groupId && e.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    setRows(
      list.map((e) => ({
        key: newKey(),
        start: e.startTime,
        end: e.endTime,
        subjectId: e.subjectId ?? undefined,
        teacherId: e.teacherId ?? undefined,
        room: e.room ?? undefined,
        activity: e.subjectId ? undefined : e.activity,
      })),
    )
    message.success(`Скопировано уроков: ${list.length}`)
  }

  const total = rows.length * days.length

  const submit = async () => {
    if (!groupId) return message.error('Выберите класс')
    if (days.length === 0) return message.error('Выберите хотя бы один день недели')
    const problem = validateRows(rows, isSchool)
    if (problem) return message.error(problem)
    try {
      setSubmitting(true)
      const res = await http.post<{ created: number; skipped: number; replaced: number }>(
        '/v1/schedule/bulk',
        toPayload(groupId, days, rows, replace),
      )
      const r = res.data
      message.success(
        r.skipped > 0
          ? `Добавлено уроков: ${r.created}. Такие уже были, пропущено: ${r.skipped}`
          : `Добавлено уроков: ${r.created}`,
      )
      onSaved()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Не удалось добавить уроки')
    } finally {
      setSubmitting(false)
    }
  }

  const gridCols = isSchool
    ? '26px 112px 112px minmax(150px, 1.5fr) minmax(130px, 1.2fr) 84px 32px'
    : '26px 112px 112px minmax(220px, 3fr) 32px'

  return (
    <Modal
      title="Добавить уроки"
      open={open}
      onCancel={onClose}
      width="min(1000px, 96vw)"
      okText={total > 0 ? `Добавить уроки (${total})` : 'Добавить уроки'}
      cancelText="Отмена"
      onOk={submit}
      confirmLoading={submitting}
      okButtonProps={{ disabled: total === 0 }}
      destroyOnClose
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              <span style={{ color: '#ff4d4f' }}>* </span>Класс
            </div>
            <Select
              style={{ width: 200 }}
              placeholder="Выберите класс"
              value={groupId}
              onChange={setGroupId}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              aria-label="Класс"
            />
          </div>

          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              <span style={{ color: '#ff4d4f' }}>* </span>Дни недели
              <Button type="link" size="small" onClick={() => setDays([1, 2, 3, 4, 5])}>
                Пн–Пт
              </Button>
              <Button type="link" size="small" onClick={() => setDays([1, 2, 3, 4, 5, 6])}>
                Пн–Сб
              </Button>
              <Button type="link" size="small" disabled={days.length === 0} onClick={() => setDays([])}>
                Снять
              </Button>
            </div>
            <Checkbox.Group
              value={days}
              onChange={(v) => setDays(v as number[])}
              options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: DAY_SHORT[d], title: DAY_NAMES[d] }))}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(127,127,127,0.08)',
          }}
        >
          <div>
            <div style={{ fontSize: 12, marginBottom: 2 }}>Уроков в дне</div>
            <InputNumber min={1} max={MAX_LESSONS} value={tpl.count} onChange={(v) => setTpl({ ...tpl, count: v ?? 1 })} aria-label="Уроков в дне" />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 2 }}>Начало первого</div>
            <TimePicker
              format="HH:mm"
              minuteStep={5}
              needConfirm={false}
              allowClear={false}
              value={toTime(tpl.start)}
              onChange={(d) => d && setTpl({ ...tpl, start: d.format('HH:mm') })}
              style={{ width: 100 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 2 }}>Урок, мин</div>
            <InputNumber min={10} max={180} value={tpl.lessonMin} onChange={(v) => setTpl({ ...tpl, lessonMin: v ?? 45 })} aria-label="Длительность урока" />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 2 }}>Перемена, мин</div>
            <InputNumber min={0} max={60} value={tpl.breakMin} onChange={(v) => setTpl({ ...tpl, breakMin: v ?? 10 })} aria-label="Перемена" />
          </div>
          <Button icon={<ThunderboltOutlined />} onClick={() => setRows(rowsFromTemplate(tpl, rows))}>
            Заполнить время
          </Button>
          {copyableDays.length > 0 && (
            <Select
              style={{ width: 190 }}
              placeholder="Скопировать день…"
              value={null as unknown as string}
              onChange={(d) => copyFromDay(d as unknown as number)}
              options={copyableDays.map((d) => ({ value: d, label: `Скопировать: ${DAY_NAMES[d]}` }))}
              aria-label="Скопировать день"
            />
          )}
        </div>

        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.75,
              marginBottom: 4,
            }}
          >
            <span>№</span>
            <span>Начало</span>
            <span>Конец</span>
            <span>{isSchool ? 'Предмет' : 'Название'}</span>
            {isSchool && <span>Учитель</span>}
            {isSchool && <span>Кабинет</span>}
            <span />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, alignItems: 'center' }}>
                <Text type="secondary">{i + 1}</Text>
                <TimePicker
                  format="HH:mm"
                  minuteStep={5}
                  needConfirm={false}
                  placeholder="Начало"
                  value={toTime(r.start)}
                  onChange={(d) => setStart(r.key, d ? d.format('HH:mm') : null)}
                  aria-label={`Начало урока ${i + 1}`}
                />
                <TimePicker
                  format="HH:mm"
                  minuteStep={5}
                  needConfirm={false}
                  placeholder="Конец"
                  value={toTime(r.end)}
                  onChange={(d) => patchRow(r.key, { end: d ? d.format('HH:mm') : null })}
                  aria-label={`Конец урока ${i + 1}`}
                />
                {isSchool ? (
                  <>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Предмет"
                      value={r.subjectId}
                      onChange={(v) => setSubject(r.key, v)}
                      options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                      aria-label={`Предмет урока ${i + 1}`}
                    />
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="Учитель"
                      value={r.teacherId}
                      onChange={(v) => patchRow(r.key, { teacherId: v })}
                      options={sortTeachers(teachers, groupId, r.subjectId).map((t) => ({ value: t.id, label: t.name }))}
                      aria-label={`Учитель урока ${i + 1}`}
                    />
                    <Input
                      placeholder="304"
                      value={r.room}
                      onChange={(e) => patchRow(r.key, { room: e.target.value })}
                      aria-label={`Кабинет урока ${i + 1}`}
                    />
                  </>
                ) : (
                  <Input
                    placeholder="Например: Развитие речи"
                    value={r.activity}
                    onChange={(e) => patchRow(r.key, { activity: e.target.value })}
                    aria-label={`Название урока ${i + 1}`}
                  />
                )}
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`Убрать урок ${i + 1}`}
                  onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                />
              </div>
            ))}
          </div>

          <Button style={{ marginTop: 10 }} icon={<PlusOutlined />} onClick={addRow} disabled={rows.length >= MAX_LESSONS}>
            Добавить урок
          </Button>
        </div>

        <Alert
          type={total > 0 ? 'info' : 'warning'}
          showIcon
          message={
            total > 0
              ? `Будет добавлено уроков: ${total} (${rows.length} в день × ${days.length} ${days.length === 1 ? 'день' : 'дн.'})`
              : 'Выберите класс, дни недели и добавьте уроки'
          }
          description={
            clash.length > 0 ? (
              <div>
                В выбранные дни у класса уже есть уроки: {clash.length}. Точные повторы пропускаются.
                <div>
                  <Checkbox checked={replace} onChange={(e) => setReplace(e.target.checked)}>
                    Заменить их: сначала убрать старые уроки этих дней
                  </Checkbox>
                </div>
              </div>
            ) : undefined
          }
        />
      </Space>
    </Modal>
  )
}
