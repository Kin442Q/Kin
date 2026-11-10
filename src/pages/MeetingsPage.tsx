import { uiLanguage, uiText } from '../i18n/uiText'
import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Grid,
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
import { SP, SproutPageHeader } from '../components/sprout'
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

const { useBreakpoint } = Grid

export default function MeetingsPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md
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
        uiText("Не удалось загрузить собрания")
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroupId])

  // У учителя в сторе уже только его классы (бэкенд отдаёт основной +
  // teachingGroups). Если класс один — подставим его в форму автоматически.
  const onlyGroupId = groups.length === 1 ? groups[0].id : undefined

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() -
          new Date(a.scheduledAt).getTime(),
      ),
    [items, uiLanguage()],
  )

  const openCreate = () => {
    form.resetFields()
    if (onlyGroupId) {
      form.setFieldsValue({ groupId: onlyGroupId })
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
        uiText("Собрание создано — родители получат Telegram-уведомление ({0})", created.group?.name || uiText("группа")),
      )
      await load()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось создать собрание")
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await meetingsService.remove(id)
      message.success(uiText("Собрание удалено"))
      await load()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось удалить")
      message.error(msg)
    }
  }

  return (
    <div>
      <SproutPageHeader
        title={uiText("Родительские собрания")}
        icon={<Megaphone size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description={uiText("Создавайте собрания для группы — родители автоматически получат уведомление в Telegram")}
        actions={
          <Space wrap>
            {!isTeacher && (
              <Select
                style={{ minWidth: 200 }}
                allowClear
                placeholder={uiText("Все группы")}
                value={filterGroupId}
                onChange={setFilterGroupId}
                options={groups.map((g) => ({
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
              {" " + uiText("Новое собрание") + " "}</Button>
          </Space>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          {isMobile ? (
            sorted.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={uiText("Пока нет собраний")}
                style={{ padding: 32 }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map((r) => {
                  const d = dayjs(r.scheduledAt)
                  const past = d.isBefore(dayjs())
                  const g = r.group || groups.find((gr) => gr.id === r.groupId)
                  return (
                    <div key={r.id} className="sp-mcard">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Tag
                          icon={<CalendarOutlined />}
                          color={past ? 'default' : 'purple'}
                          style={{ margin: 0 }}
                        >
                          {d.format('DD.MM.YYYY HH:mm')}
                        </Tag>
                        {g && (
                          <Tag
                            color={g.color || 'blue'}
                            style={{ margin: 0 }}
                          >
                            {g.name}
                          </Tag>
                        )}
                        <div style={{ marginLeft: 'auto' }}>
                          <Popconfirm
                            title={uiText("Удалить собрание?")}
                            okText={uiText("Удалить")}
                            cancelText={uiText("Отмена")}
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
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: SP.text,
                          marginBottom: 4,
                        }}
                      >
                        {r.title}
                      </div>
                      {r.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: SP.muted,
                            marginBottom: 4,
                          }}
                        >
                          {r.description}
                        </div>
                      )}
                      {r.location && (
                        <div
                          style={{
                            fontSize: 12,
                            color: SP.textMid,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <EnvironmentOutlined /> {r.location}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : (
          <Table
            rowKey="id"
            loading={loading}
            dataSource={sorted}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={uiText("Пока нет собраний")}
                />
              ),
            }}
            columns={[
              {
                title: uiText("Дата и время"),
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
                title: uiText("Тема"),
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
                title: uiText("Группа"),
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
                title: uiText("Место"),
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
                    title={uiText("Удалить собрание?")}
                    description={uiText("Действие нельзя отменить")}
                    okText={uiText("Удалить")}
                    cancelText={uiText("Отмена")}
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
          )}
        </Card>
      </motion.div>

      <Modal
        title={uiText("Новое родительское собрание")}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText={uiText("Создать и уведомить")}
        cancelText={uiText("Отмена")}
        confirmLoading={submitting}
        destroyOnClose
        width={560}
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item
            name="groupId"
            label={uiText("Группа")}
            rules={[{ required: true, message: uiText("Выберите группу") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={uiText("Выберите группу")}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label={uiText("Тема")}
            rules={[{ required: true, message: uiText("Укажите тему") }]}
          >
            <Input
              maxLength={200}
              placeholder={uiText("Например: Итоги первого полугодия")}
            />
          </Form.Item>
          <Form.Item
            name="scheduledAt"
            label={uiText("Дата и время")}
            rules={[{ required: true, message: uiText("Выберите дату и время") }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="DD.MM.YYYY HH:mm"
              style={{ width: '100%' }}
              placeholder={uiText("Когда состоится")}
            />
          </Form.Item>
          <Form.Item name="location" label={uiText("Место (необязательно)")}>
            <Input
              maxLength={200}
              placeholder={uiText("Кабинет / адрес / онлайн-ссылка")}
            />
          </Form.Item>
          <Form.Item name="description" label={uiText("Повестка / описание (необязательно)")}>
            <Input.TextArea
              rows={3}
              maxLength={2000}
              showCount
              placeholder={uiText("Что обсудим")}
            />
          </Form.Item>
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            {" " + uiText("После создания все родители группы, привязавшие телефон к Telegram-боту, получат уведомление автоматически.") + " "}</div>
        </Form>
      </Modal>
    </div>
  )
}
