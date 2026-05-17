import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
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
import { http } from '../api'
import { ScheduleItem } from '../types'

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

const { useBreakpoint } = Grid

export default function SchedulePage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const groups = useDataStore((s) => s.groups)

  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [groupId, setGroupId] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    try {
      setLoading(true)
      const res = await http.get<ScheduleItem[]>('/v1/schedule', {
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

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          a.dayOfWeek - b.dayOfWeek ||
          a.startTime.localeCompare(b.startTime),
      ),
    [items],
  )

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)
      await http.post('/v1/schedule', {
        groupId: v.groupId,
        dayOfWeek: v.dayOfWeek,
        startTime: dayjs(v.startTime).format('HH:mm'),
        endTime: dayjs(v.endTime).format('HH:mm'),
        activity: v.activity,
      })
      setOpen(false)
      form.resetFields()
      message.success('Добавлено')
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
        title="Расписание"
        icon={<Calendar size={22} strokeWidth={2} />}
        iconAccent="blue"
        description="Расписание занятий по группам"
        actions={
          <Space>
            <Select
              style={{ minWidth: 200 }}
              allowClear
              placeholder="Все группы"
              value={groupId}
              onChange={setGroupId}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
            >
              Добавить
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
          {isMobile ? (
            sorted.length === 0 ? (
              <SproutEmpty
                icon={<Calendar size={28} strokeWidth={1.8} />}
                title="Расписание пустое"
                description="Добавьте первое занятие кнопкой «Добавить»"
                minHeight={180}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map((r) => {
                  const g = groups.find((gr) => gr.id === r.groupId)
                  return (
                    <div key={r.id} className="sp-mcard">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 6,
                        }}
                      >
                        <Tag
                          style={{
                            background: SP.lilacSoft,
                            color: SP.lilacDeep,
                            border: 'none',
                            margin: 0,
                            fontWeight: 600,
                          }}
                        >
                          {DAYS[r.dayOfWeek]}
                        </Tag>
                        <Tag
                          style={{
                            background: SP.blueSoft,
                            color: SP.blueDeep,
                            border: 'none',
                            margin: 0,
                          }}
                        >
                          {r.startTime} – {r.endTime}
                        </Tag>
                        <div style={{ marginLeft: 'auto' }}>
                          <Popconfirm
                            title="Удалить занятие?"
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
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: SP.text,
                          marginBottom: 4,
                        }}
                      >
                        {r.activity}
                      </div>
                      {g && (
                        <div style={{ fontSize: 12, color: SP.muted }}>
                          Группа: <strong>{g.name}</strong>
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
            pagination={false}
            locale={{
              emptyText: (
                <SproutEmpty
                  icon={<Calendar size={28} strokeWidth={1.8} />}
                  title="Расписание пустое"
                  description="Добавьте первое занятие"
                  minHeight={180}
                />
              ),
            }}
            columns={[
              {
                title: 'День',
                dataIndex: 'dayOfWeek',
                render: (v: number) => <Tag color="purple">{DAYS[v]}</Tag>,
                sorter: (a, b) => a.dayOfWeek - b.dayOfWeek,
                defaultSortOrder: 'ascend',
              },
              {
                title: 'Время',
                key: 'time',
                render: (_, r: ScheduleItem) => (
                  <Tag color="geekblue">
                    {r.startTime} – {r.endTime}
                  </Tag>
                ),
              },
              { title: 'Активность', dataIndex: 'activity' },
              {
                title: 'Группа',
                dataIndex: 'groupId',
                render: (v: string) =>
                  groups.find((g) => g.id === v)?.name || '—',
              },
              {
                title: '',
                key: 'a',
                render: (_, r) => (
                  <Popconfirm
                    title="Удалить занятие?"
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
          )}
        </Card>
      </motion.div>

      <Modal
        title="Добавить занятие"
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
            label="Группа"
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
          <Form.Item
            name="activity"
            label="Активность"
            rules={[{ required: true }]}
          >
            <Input placeholder="Например: Развитие речи" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
