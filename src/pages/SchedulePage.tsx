import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  TimePicker,
  App as AntdApp,
} from 'antd'
import { CalendarOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import PageHeader from '../components/PageHeader'
import { useDataStore } from '../store/dataStore'
import { uid } from '../lib/uid'
import { ScheduleItem } from '../types'

const DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

export default function SchedulePage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const schedule = useDataStore((s) => s.schedule)
  const upsert = useDataStore((s) => s.upsertSchedule)
  const remove = useDataStore((s) => s.deleteSchedule)

  const [groupId, setGroupId] = useState<string | undefined>(groups[0]?.id)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const items = useMemo(
    () => schedule.filter((s) => !groupId || s.groupId === groupId).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    [schedule, groupId],
  )

  const submit = async () => {
    try {
      const v = await form.validateFields()
      const data: ScheduleItem = {
        id: uid(),
        groupId: v.groupId,
        dayOfWeek: v.dayOfWeek,
        startTime: dayjs(v.startTime).format('HH:mm'),
        endTime: dayjs(v.endTime).format('HH:mm'),
        activity: v.activity,
      }
      upsert(data)
      setOpen(false)
      form.resetFields()
      message.success('Добавлено')
    } catch {
      /* */
    }
  }

  return (
    <div>
      <PageHeader
        title="Расписание"
        icon={<CalendarOutlined />}
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
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
          <Table
            rowKey="id"
            dataSource={items}
            pagination={false}
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
                render: (v: string) => groups.find((g) => g.id === v)?.name || '—',
              },
              {
                title: '',
                key: 'a',
                render: (_, r) => (
                  <Button danger size="small" type="text" icon={<DeleteOutlined />} onClick={() => remove(r.id)} />
                ),
              },
            ]}
          />
        </Card>
      </motion.div>

      <Modal
        title="Добавить занятие"
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="Добавить"
        cancelText="Отмена"
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="groupId" label="Группа" rules={[{ required: true }]}>
            <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Form.Item name="dayOfWeek" label="День недели" rules={[{ required: true }]}>
            <Select options={DAYS.slice(1).map((d, i) => ({ value: i + 1, label: d }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="startTime" label="Начало" rules={[{ required: true }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="Конец" rules={[{ required: true }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="activity" label="Активность" rules={[{ required: true }]}>
            <Input placeholder="Например: Развитие речи" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
