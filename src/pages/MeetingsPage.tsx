import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  App as AntdApp,
} from 'antd'
import {
  TeamOutlined,
  PlusOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs, { type Dayjs } from 'dayjs'

import { Megaphone } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { meetingsService } from '../api'
import type { Meeting } from '../types'

interface MeetingFormValues {
  groupId: string
  title: string
  scheduledAt: Dayjs
  location?: string
  description?: string
}

export default function MeetingsPage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const user = useAuthStore((s) => s.user)

  const isTeacher =
    user?.role === 'TEACHER' || user?.role === 'teacher'

  const [items, setItems] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [filterGroupId, setFilterGroupId] = useState<string | undefined>(
    undefined,
  )
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<MeetingFormValues>()

  const load = async () => {
    try {
      setLoading(true)
      const res = await meetingsService.list(filterGroupId)
      setItems(res || [])
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить собрания'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroupId])

  // Учитель видит только свою группу — фиксируем её в форме
  const teacherGroupId = isTeacher ? user?.groupId : undefined
  const formInitialGroupId = teacherGroupId ?? undefined

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() -
          new Date(a.scheduledAt).getTime(),
      ),
    [items],
  )

  const openCreate = () => {
    form.resetFields()
    if (formInitialGroupId) {
      form.setFieldsValue({ groupId: formInitialGroupId })
    }
    setOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)
      const created = await meetingsService.create({
        groupId: v.groupId,
        title: v.title.trim(),
        scheduledAt: v.scheduledAt.toISOString(),
        location: v.location?.trim() || undefined,
        description: v.description?.trim() || undefined,
      })
      setOpen(false)
      form.resetFields()
      message.success(
        `Собрание создано — родители получат Telegram-уведомление (${created.group?.name || 'группа'})`,
      )
      await load()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось создать собрание'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await meetingsService.remove(id)
      message.success('Собрание удалено')
      await load()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось удалить'
      message.error(msg)
    }
  }

  const groupsForFilter = isTeacher
    ? groups.filter((g) => g.id === teacherGroupId)
    : groups

  return (
    <div>
      <SproutPageHeader
        title="Родительские собрания"
        icon={<Megaphone size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description="Создавайте собрания для группы — родители автоматически получат уведомление в Telegram"
        actions={
          <Space wrap>
            {!isTeacher && (
              <Select
                style={{ minWidth: 200 }}
                allowClear
                placeholder="Все группы"
                value={filterGroupId}
                onChange={setFilterGroupId}
                options={groupsForFilter.map((g) => ({
                  value: g.id,
                  label: g.name,
                }))}
              />
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
            >
              Новое собрание
            </Button>
          </Space>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={sorted}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Пока нет собраний"
                />
              ),
            }}
            columns={[
              {
                title: 'Дата и время',
                dataIndex: 'scheduledAt',
                width: 200,
                render: (v: string) => {
                  const d = dayjs(v)
                  const past = d.isBefore(dayjs())
                  return (
                    <Tag
                      color={past ? 'default' : 'purple'}
                      icon={<CalendarOutlined />}
                    >
                      {d.format('DD.MM.YYYY HH:mm')}
                    </Tag>
                  )
                },
                sorter: (a, b) =>
                  new Date(a.scheduledAt).getTime() -
                  new Date(b.scheduledAt).getTime(),
                defaultSortOrder: 'descend',
              },
              {
                title: 'Тема',
                dataIndex: 'title',
                render: (v: string, r: Meeting) => (
                  <Space direction="vertical" size={2}>
                    <strong>{v}</strong>
                    {r.description && (
                      <span
                        style={{
                          fontSize: 12,
                          opacity: 0.65,
                          maxWidth: 360,
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <Tooltip title={r.description}>
                          {r.description}
                        </Tooltip>
                      </span>
                    )}
                  </Space>
                ),
              },
              {
                title: 'Группа',
                dataIndex: 'groupId',
                render: (v: string, r: Meeting) => {
                  const g =
                    r.group || groups.find((gr) => gr.id === v)
                  return g ? (
                    <Tag color={g.color || 'blue'}>{g.name}</Tag>
                  ) : (
                    '—'
                  )
                },
              },
              {
                title: 'Место',
                dataIndex: 'location',
                render: (v: string | null) =>
                  v ? (
                    <Space size={4}>
                      <EnvironmentOutlined />
                      {v}
                    </Space>
                  ) : (
                    '—'
                  ),
              },
              {
                title: '',
                key: 'actions',
                width: 60,
                render: (_, r) => (
                  <Popconfirm
                    title="Удалить собрание?"
                    description="Действие нельзя отменить"
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
                ),
              },
            ]}
          />
        </Card>
      </motion.div>

      <Modal
        title="Новое родительское собрание"
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="Создать и уведомить"
        cancelText="Отмена"
        confirmLoading={submitting}
        destroyOnClose
        width={560}
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item
            name="groupId"
            label="Группа"
            rules={[{ required: true, message: 'Выберите группу' }]}
          >
            <Select
              disabled={isTeacher}
              placeholder="Выберите группу"
              options={(isTeacher ? groupsForFilter : groups).map((g) => ({
                value: g.id,
                label: g.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="Тема"
            rules={[{ required: true, message: 'Укажите тему' }]}
          >
            <Input
              maxLength={200}
              placeholder="Например: Итоги первого полугодия"
            />
          </Form.Item>
          <Form.Item
            name="scheduledAt"
            label="Дата и время"
            rules={[{ required: true, message: 'Выберите дату и время' }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="DD.MM.YYYY HH:mm"
              style={{ width: '100%' }}
              placeholder="Когда состоится"
            />
          </Form.Item>
          <Form.Item name="location" label="Место (необязательно)">
            <Input
              maxLength={200}
              placeholder="Кабинет / адрес / онлайн-ссылка"
            />
          </Form.Item>
          <Form.Item name="description" label="Повестка / описание (необязательно)">
            <Input.TextArea
              rows={3}
              maxLength={2000}
              showCount
              placeholder="Что обсудим"
            />
          </Form.Item>
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            После создания все родители группы, привязавшие телефон к
            Telegram-боту, получат уведомление автоматически.
          </div>
        </Form>
      </Modal>
    </div>
  )
}
