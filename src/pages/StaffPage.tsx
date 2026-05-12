import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  App as AntdApp,
  Tooltip,
} from 'antd'
import {
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  PhoneOutlined,
  MailOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import PageHeader from '../components/PageHeader'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { formatDate, formatMoney } from '../lib/format'
import { uid } from '../lib/uid'
import { POSITIONS, Position, Staff } from '../types'

const { Text } = Typography

export default function StaffPage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const staff = useDataStore((s) => s.staff)
  const upsertStaff = useDataStore((s) => s.upsertStaff)
  const deleteStaff = useDataStore((s) => s.deleteStaff)

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<Position | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form] = Form.useForm()

  const list = useMemo(() => {
    let r = staff
    if (posFilter) r = r.filter((s) => s.position === posFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((s) =>
        (s.firstName + ' ' + s.lastName + ' ' + s.phone + ' ' + (s.email || '')).toLowerCase().includes(q),
      )
    }
    return r
  }, [staff, posFilter, search])

  const totalSalary = staff.reduce((sum, s) => sum + (s.salary || 0), 0)

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ position: 'Воспитатель', hireDate: dayjs(), salary: 3500 })
    setDrawerOpen(true)
  }

  const openEdit = (s: Staff) => {
    setEditing(s)
    form.setFieldsValue({ ...s, hireDate: dayjs(s.hireDate) })
    setDrawerOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      const data: Staff = {
        id: editing?.id ?? uid(),
        firstName: v.firstName,
        lastName: v.lastName,
        middleName: v.middleName,
        position: v.position,
        phone: v.phone,
        email: v.email,
        groupId: v.groupId,
        salary: v.salary || 0,
        hireDate: dayjs(v.hireDate).format('YYYY-MM-DD'),
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      }
      upsertStaff(data)
      setDrawerOpen(false)
      message.success(editing ? 'Сотрудник обновлён' : 'Сотрудник добавлен')
    } catch {
      /* validation */
    }
  }

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        icon={<TeamOutlined />}
        description="Управление персоналом и зарплатами"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новый сотрудник
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}>
          <StatCard title="Всего сотрудников" value={staff.length} variant="primary" />
        </Col>
        <Col xs={12} md={8}>
          <StatCard
            title="Воспитателей"
            value={staff.filter((s) => s.position === 'Воспитатель').length}
            variant="success"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard title="ФОТ в месяц" value={totalSalary} format="money" variant="warning" />
        </Col>
      </Row>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4"
      >
        <Card className="glass" bordered={false}>
          <Row gutter={[12, 12]} className="mb-3">
            <Col xs={24} md={12}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Поиск по имени, телефону, email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="Все должности"
                value={posFilter}
                onChange={(v) => setPosFilter(v as Position | undefined)}
                options={POSITIONS.map((p) => ({ value: p, label: p }))}
              />
            </Col>
          </Row>

          <Table
            rowKey="id"
            dataSource={list}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
            columns={[
              {
                title: 'Сотрудник',
                key: 'fio',
                render: (_, s: Staff) => (
                  <Space>
                    <Avatar
                      size={36}
                      style={{
                        background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                      }}
                    >
                      {s.firstName[0]}
                    </Avatar>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {s.lastName} {s.firstName}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        с {formatDate(s.hireDate)}
                      </Text>
                    </div>
                  </Space>
                ),
              },
              {
                title: 'Должность',
                dataIndex: 'position',
                render: (v) => <Tag color="geekblue">{v}</Tag>,
              },
              {
                title: 'Группа',
                dataIndex: 'groupId',
                render: (v?: string) => {
                  if (!v) return <Tag>—</Tag>
                  const g = groups.find((x) => x.id === v)
                  return g ? <Tag color="purple">{g.name}</Tag> : <Tag>—</Tag>
                },
              },
              {
                title: 'Контакты',
                key: 'contacts',
                render: (_, s) => (
                  <div className="text-xs">
                    <div>
                      <PhoneOutlined /> {s.phone}
                    </div>
                    {s.email && (
                      <div>
                        <MailOutlined /> {s.email}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: 'Зарплата',
                dataIndex: 'salary',
                sorter: (a, b) => (a.salary || 0) - (b.salary || 0),
                render: (v: number) => <Text strong>{formatMoney(v)}</Text>,
              },
              {
                title: '',
                key: 'actions',
                render: (_, s) => (
                  <Space>
                    <Tooltip title="Редактировать">
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(s)} />
                    </Tooltip>
                    <Popconfirm title="Удалить сотрудника?" onConfirm={() => { deleteStaff(s.id); message.success('Удалено') }}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </motion.div>

      <Drawer
        title={editing ? 'Редактировать сотрудника' : 'Новый сотрудник'}
        width={460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Отмена</Button>
            <Button type="primary" onClick={submit}>
              Сохранить
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="lastName" label="Фамилия" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstName" label="Имя" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="position" label="Должность" rules={[{ required: true }]}>
            <Select options={POSITIONS.map((p) => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="groupId" label="Группа (если применимо)">
            <Select allowClear options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Form.Item name="phone" label="Телефон" rules={[{ required: true }]}>
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input prefix={<MailOutlined />} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="salary" label="Зарплата">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="сомони" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hireDate" label="Дата найма" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </div>
  )
}
