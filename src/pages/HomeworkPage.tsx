import { useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { SP, SproutPageHeader, SproutEmpty } from '../components/sprout'
import { useDataStore } from '../store/dataStore'
import { http } from '../api'

const { Text } = Typography

interface SubjectDto {
  id: string
  name: string
  color: string
}

interface HomeworkDto {
  id: string
  subjectId: string
  groupId: string
  title: string
  description: string | null
  dueDate: string
  attachments: string[]
  authorId: string
  subject?: { id: string; name: string; color: string }
  group?: { id: string; name: string }
  createdAt: string
}

type Filter = 'all' | 'upcoming' | 'past'

export default function HomeworkPage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)

  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [items, setItems] = useState<HomeworkDto[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)

  // Modal
  const [editing, setEditing] = useState<HomeworkDto | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // ─── Загрузка ────────────────────────────────────────────────────
  useEffect(() => {
    http
      .get<SubjectDto[]>('/v1/subjects')
      .then((r) => setSubjects(r.data))
      .catch((e) =>
        message.error(e?.response?.data?.message || 'Не удалось загрузить предметы'),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadHomework = async () => {
    setLoading(true)
    try {
      const r = await http.get<HomeworkDto[]>('/v1/homework', {
        params: {
          groupId: groupFilter ?? undefined,
          subjectId: subjectFilter ?? undefined,
        },
      })
      setItems(r.data)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось загрузить ДЗ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHomework()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter, subjectFilter])

  const visible = useMemo(() => {
    const now = Date.now() - 24 * 3600 * 1000
    return items.filter((h) => {
      const due = new Date(h.dueDate).getTime()
      if (filter === 'upcoming') return due >= now
      if (filter === 'past') return due < now
      return true
    })
  }, [items, filter])

  // ─── Modal handlers ──────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      dueDate: dayjs().add(1, 'day'),
    })
    setModalOpen(true)
  }
  const openEdit = (h: HomeworkDto) => {
    setEditing(h)
    form.setFieldsValue({
      subjectId: h.subjectId,
      groupId: h.groupId,
      title: h.title,
      description: h.description,
      dueDate: dayjs(h.dueDate),
    })
    setModalOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSaving(true)
      const body = {
        subjectId: v.subjectId,
        groupId: v.groupId,
        title: v.title.trim(),
        description: v.description?.trim() || undefined,
        dueDate: dayjs(v.dueDate).format('YYYY-MM-DD'),
      }
      if (editing) {
        await http.patch(`/v1/homework/${editing.id}`, {
          title: body.title,
          description: body.description,
          dueDate: body.dueDate,
        })
        message.success('ДЗ обновлено')
      } else {
        await http.post('/v1/homework', body)
        message.success('ДЗ создано — родителям отправится уведомление')
      }
      setModalOpen(false)
      await loadHomework()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (h: HomeworkDto) => {
    try {
      await http.delete(`/v1/homework/${h.id}`)
      message.success('Удалено')
      await loadHomework()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка')
    }
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div>
      <SproutPageHeader
        title="Домашние задания"
        icon={<BookOpen size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description="Задания для класса с автоматической рассылкой родителям"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Задать ДЗ
          </Button>
        }
      />

      <Card className="glass" bordered={false} style={{ marginBottom: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700, marginBottom: 4 }}>
              ПЕРИОД
            </div>
            <Segmented
              block
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'upcoming', label: 'Активные' },
                { value: 'past', label: 'Прошедшие' },
                { value: 'all', label: 'Все' },
              ]}
            />
          </Col>
          <Col xs={12} md={8}>
            <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700, marginBottom: 4 }}>
              КЛАСС
            </div>
            <Select
              allowClear
              placeholder="Все классы"
              style={{ width: '100%' }}
              value={groupFilter ?? undefined}
              onChange={(v) => setGroupFilter(v ?? null)}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </Col>
          <Col xs={12} md={8}>
            <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700, marginBottom: 4 }}>
              ПРЕДМЕТ
            </div>
            <Select
              allowClear
              placeholder="Все предметы"
              style={{ width: '100%' }}
              value={subjectFilter ?? undefined}
              onChange={(v) => setSubjectFilter(v ?? null)}
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
          </Col>
        </Row>
      </Card>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {visible.length === 0 ? (
          <Card className="glass" bordered={false}>
            <SproutEmpty
              icon={<BookOpen size={32} strokeWidth={1.8} />}
              title="Заданий нет"
              description={
                filter === 'upcoming'
                  ? 'Активных ДЗ пока нет. Нажмите «Задать ДЗ» чтобы создать.'
                  : 'Ничего не найдено по фильтрам.'
              }
              minHeight={200}
            />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map((h) => {
              const due = new Date(h.dueDate)
              const overdue = due.getTime() < Date.now() - 24 * 3600 * 1000
              return (
                <Card
                  key={h.id}
                  className="glass"
                  bordered={false}
                  bodyStyle={{ padding: 14, opacity: overdue ? 0.65 : 1 }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    {/* Date card */}
                    <div
                      style={{
                        width: 60,
                        padding: '8px 4px',
                        borderRadius: 12,
                        background: h.subject?.color
                          ? `${h.subject.color}22`
                          : SP.primarySoft,
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 22,
                          color: h.subject?.color ?? SP.primaryDeep,
                          letterSpacing: -0.5,
                        }}
                      >
                        {dayjs(h.dueDate).format('DD')}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: h.subject?.color ?? SP.primaryDeep,
                        }}
                      >
                        {dayjs(h.dueDate).format('MMM')}
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Tag
                          style={{
                            background: h.subject?.color ?? SP.primary,
                            color: '#fff',
                            border: 'none',
                            fontWeight: 700,
                          }}
                        >
                          {h.subject?.name ?? '—'}
                        </Tag>
                        <Tag style={{ background: SP.surfaceAlt, border: 'none' }}>
                          {h.group?.name ?? '—'}
                        </Tag>
                        {overdue && <Tag color="red">просрочено</Tag>}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: SP.text, marginTop: 6 }}>
                        {h.title}
                      </div>
                      {h.description && (
                        <Text
                          type="secondary"
                          style={{ fontSize: 13, display: 'block', marginTop: 4, lineHeight: 1.4 }}
                        >
                          {h.description}
                        </Text>
                      )}
                    </div>

                    {/* Actions */}
                    <Space>
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(h)}
                      />
                      <Popconfirm
                        title="Удалить ДЗ?"
                        okText="Удалить"
                        cancelText="Отмена"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => remove(h)}
                      >
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
        {loading && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Загружаю...
          </Text>
        )}
      </motion.div>

      {/* Modal */}
      <Modal
        title={editing ? 'Редактировать ДЗ' : 'Задать ДЗ'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText={editing ? 'Сохранить' : 'Задать'}
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="subjectId"
                label="Предмет"
                rules={[{ required: true, message: 'Выберите предмет' }]}
              >
                <Select
                  disabled={!!editing}
                  options={subjects.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  placeholder="Выберите"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="groupId"
                label="Класс"
                rules={[{ required: true, message: 'Выберите класс' }]}
              >
                <Select
                  disabled={!!editing}
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                  placeholder="Выберите"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="Заголовок"
            rules={[{ required: true, message: 'Введите заголовок' }]}
          >
            <Input placeholder="Упр. 23 на стр. 45" />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Подробности задания" />
          </Form.Item>

          <Form.Item
            name="dueDate"
            label="Срок сдачи"
            rules={[{ required: true, message: 'Укажите срок' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
