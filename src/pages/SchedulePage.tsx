import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  TimePicker,
  App as AntdApp,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { Calendar } from 'lucide-react'
import { SP, SproutPageHeader, SproutEmpty } from '../components/sprout'
import { useDataStore } from '../store/dataStore'
import { useLabels } from '../hooks/useLabels'
import { http } from '../api'
import { ScheduleItem } from '../types'

interface ScheduleApi extends ScheduleItem {
  subjectId?: string | null
  teacherId?: string | null
  room?: string | null
  subject?: { id: string; name: string; color: string } | null
}

interface SubjectDto {
  id: string
  name: string
  color: string
}

interface StaffDto {
  id: string
  firstName: string
  lastName: string
}

const DAYS = [
  '',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
]

// Цвет дня недели для карточек расписания (мягкий фон + насыщенный акцент).
const DAY_STYLE: Record<number, { soft: string; deep: string }> = {
  1: { soft: SP.blueSoft, deep: SP.blueDeep },
  2: { soft: SP.lilacSoft, deep: SP.lilacDeep },
  3: { soft: SP.primaryGhost, deep: SP.primaryDeep },
  4: { soft: SP.yellowSoft, deep: SP.yellowDeep },
  5: { soft: SP.roseSoft, deep: SP.roseDeep },
  6: { soft: SP.cyanSoft, deep: SP.cyan },
  7: { soft: SP.pinkSoft, deep: SP.pink },
}

export default function SchedulePage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const L = useLabels()
  const isSchool = L.group === 'класс'

  const [items, setItems] = useState<ScheduleApi[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [groupId, setGroupId] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  // Школьные справочники
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [teachers, setTeachers] = useState<StaffDto[]>([])

  useEffect(() => {
    if (!isSchool) return
    http
      .get<SubjectDto[]>('/v1/subjects')
      .then((r) => setSubjects(r.data))
      .catch(() => {})
    http
      .get<StaffDto[]>('/v1/staff')
      .then((r) => setTeachers(r.data))
      .catch(() => {})
  }, [isSchool])

  const load = async () => {
    try {
      setLoading(true)
      const res = await http.get<ScheduleApi[]>('/v1/schedule', {
        params: groupId ? { groupId } : undefined,
      })
      setItems(res.data || [])
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить расписание'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  // Группируем уроки по дню недели, внутри дня — по времени начала.
  const byDay = useMemo(() => {
    const map: Record<number, ScheduleApi[]> = {}
    for (const it of items) {
      ;(map[it.dayOfWeek] ||= []).push(it)
    }
    for (const k of Object.keys(map)) {
      map[+k].sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [items])

  // Дни-карточки: Пн→Сб всегда; Вс — только если на него есть уроки.
  const visibleDays = useMemo(() => {
    const base = [1, 2, 3, 4, 5, 6]
    if (byDay[7]?.length) base.push(7)
    return base
  }, [byDay])

  // Сегодняшний день недели (1=Пн..7=Вс) — для подсветки активной карточки.
  const todayDow = ((new Date().getDay() + 6) % 7) + 1

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)
      // Для школы activity = название предмета (для обратной совместимости)
      let activity = v.activity
      if (isSchool && v.subjectId) {
        const subj = subjects.find((s) => s.id === v.subjectId)
        if (subj) activity = subj.name
      }
      await http.post('/v1/schedule', {
        groupId: v.groupId,
        dayOfWeek: v.dayOfWeek,
        startTime: dayjs(v.startTime).format('HH:mm'),
        endTime: dayjs(v.endTime).format('HH:mm'),
        activity,
        subjectId: isSchool ? v.subjectId || undefined : undefined,
        teacherId: isSchool ? v.teacherId || undefined : undefined,
        room: isSchool ? v.room?.trim() || undefined : undefined,
      })
      setOpen(false)
      form.resetFields()
      message.success(isSchool ? 'Урок добавлен' : 'Занятие добавлено')
      await load()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось добавить'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await http.delete(`/v1/schedule/${id}`)
      message.success('Удалено')
      await load()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось удалить'
      message.error(msg)
    }
  }

  return (
    <div>
      <SproutPageHeader
        title={isSchool ? 'Расписание уроков' : 'Расписание'}
        icon={<Calendar size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={
          isSchool
            ? 'Уроки по классам: предмет, учитель, кабинет'
            : 'Расписание занятий по группам'
        }
        actions={
          <Space>
            <Select
              style={{ minWidth: 200 }}
              allowClear
              placeholder={isSchool ? 'Все классы' : 'Все группы'}
              value={groupId}
              onChange={setGroupId}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
            >
              {isSchool ? 'Добавить урок' : 'Добавить'}
            </Button>
          </Space>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {groups.length === 0 ? (
          <Card className="glass" bordered={false}>
            <SproutEmpty
              icon={<Calendar size={28} strokeWidth={1.8} />}
              title={isSchool ? 'Классов пока нет' : 'Групп пока нет'}
              description={
                isSchool
                  ? 'Сначала создайте класс в разделе «Классы»'
                  : 'Сначала создайте группу'
              }
              minHeight={180}
            />
          </Card>
        ) : (
          <Spin spinning={loading}>
            <Row gutter={[16, 16]} align="stretch">
              {visibleDays.map((d) => {
                const dayItems = byDay[d] ?? []
                const st = DAY_STYLE[d]
                const isToday = d === todayDow
                return (
                  <Col xs={24} sm={12} lg={8} key={d}>
                    <div
                      className={`sp-day-card${isToday ? ' sp-day-card--today' : ''}`}
                      style={{ ['--day-accent' as any]: st.deep }}
                    >
                      {/* Шапка дня */}
                      <div className="sp-day-head" style={{ background: st.soft }}>
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 3,
                            background: st.deep,
                          }}
                        />
                        <span
                          style={{ fontWeight: 800, fontSize: 14, color: st.deep }}
                        >
                          {DAYS[d]}
                        </span>
                        {isToday && (
                          <span
                            className="sp-today-badge"
                            style={{ background: st.deep }}
                          >
                            Сегодня
                          </span>
                        )}
                        <span className="sp-day-count" style={{ color: st.deep }}>
                          {dayItems.length}
                        </span>
                      </div>

                      {/* Уроки дня */}
                      {dayItems.length === 0 ? (
                        <div className="sp-day-empty">
                          {isSchool ? 'Уроков нет' : 'Занятий нет'}
                        </div>
                      ) : (
                        <div>
                          {dayItems.map((r, idx) => {
                            const t = r.teacherId
                              ? teachers.find((x) => x.id === r.teacherId)
                              : null
                            const g = groups.find((gr) => gr.id === r.groupId)
                            const meta = [
                              isSchool && t
                                ? `${t.lastName} ${t.firstName[0]}.`
                                : null,
                              isSchool && r.room ? `каб. ${r.room}` : null,
                              !groupId && g ? g.name : null,
                            ].filter(Boolean)
                            return (
                              <div
                                key={r.id}
                                className="sp-lesson"
                                style={{
                                  borderBottom:
                                    idx < dayItems.length - 1
                                      ? `1px solid ${SP.borderSoft}`
                                      : 'none',
                                }}
                              >
                                <div
                                  className="sp-lesson-time"
                                  style={{ background: st.soft, color: st.deep }}
                                >
                                  <span>{r.startTime}</span>
                                  <span>{r.endTime}</span>
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        background: r.subject?.color ?? SP.muted,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        fontSize: 14,
                                        color: SP.text,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {r.subject?.name ?? r.activity}
                                    </span>
                                  </div>
                                  {meta.length > 0 && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: SP.muted,
                                        marginTop: 2,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {meta.join(' · ')}
                                    </div>
                                  )}
                                </div>
                                <Popconfirm
                                  title={
                                    isSchool ? 'Удалить урок?' : 'Удалить занятие?'
                                  }
                                  okText="Удалить"
                                  cancelText="Отмена"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => remove(r.id)}
                                >
                                  <Button
                                    danger
                                    size="small"
                                    type="text"
                                    icon={<DeleteOutlined />}
                                  />
                                </Popconfirm>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </Col>
                )
              })}
            </Row>
          </Spin>
        )}
      </motion.div>

      <Modal
        title={isSchool ? 'Добавить урок' : 'Добавить занятие'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="groupId"
            label={isSchool ? 'Класс' : 'Группа'}
            rules={[{ required: true }]}
          >
            <Select
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </Form.Item>
          <Form.Item
            name="dayOfWeek"
            label="День недели"
            rules={[{ required: true }]}
          >
            <Select
              options={DAYS.slice(1).map((d, i) => ({
                value: i + 1,
                label: d,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label="Начало"
                rules={[{ required: true }]}
              >
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label="Конец"
                rules={[{ required: true }]}
              >
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>

          {isSchool ? (
            <>
              <Form.Item
                name="subjectId"
                label="Предмет"
                rules={[{ required: true, message: 'Выберите предмет' }]}
              >
                <Select
                  placeholder="Выберите предмет"
                  options={subjects.map((s) => ({
                    value: s.id,
                    label: (
                      <Space size={4}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: s.color,
                          }}
                        />
                        {s.name}
                      </Space>
                    ),
                  }))}
                />
              </Form.Item>
              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item name="teacherId" label="Учитель (опц.)">
                    <Select
                      allowClear
                      placeholder="Выберите учителя"
                      options={teachers.map((t) => ({
                        value: t.id,
                        label: `${t.lastName} ${t.firstName}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="room" label="Кабинет (опц.)">
                    <Input placeholder="304" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : (
            <Form.Item
              name="activity"
              label="Активность"
              rules={[{ required: true }]}
            >
              <Input placeholder="Например: Развитие речи" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
