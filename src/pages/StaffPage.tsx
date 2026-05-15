import { useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Grid,
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
import { http } from '../api'
import {
  toBackendPosition,
  toRussianPosition,
  StaffPositionEnum,
} from '../lib/positionMap'
import { POSITIONS, Position, Staff } from '../types'

// 'Воспитатель' создаётся через /admin/teachers (User с role=TEACHER), а не Staff
const STAFF_POSITIONS = POSITIONS.filter((p) => p !== 'Воспитатель')

interface StaffApi {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  position: StaffPositionEnum
  phone: string
  email: string | null
  groupId: string | null
  salary: number | string
  hireDate: string
  createdAt: string
}

const { Text } = Typography
const { useBreakpoint } = Grid

export default function StaffPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const groups = useDataStore((s) => s.groups)

  const [staffApi, setStaffApi] = useState<StaffApi[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<Position | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form] = Form.useForm()

  const loadStaff = async () => {
    try {
      setLoading(true)
      const res = await http.get<StaffApi[]>('/v1/staff')
      setStaffApi(res.data)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить сотрудников'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Преобразуем API данные → формат UI (с русскими позициями)
  const staff: Staff[] = useMemo(
    () =>
      staffApi.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        middleName: s.middleName || undefined,
        position: toRussianPosition(s.position) as Position,
        phone: s.phone,
        email: s.email || undefined,
        groupId: s.groupId || undefined,
        salary: Number(s.salary) || 0,
        hireDate: s.hireDate.slice(0, 10),
        createdAt: s.createdAt,
      })),
    [staffApi],
  )

  const list = useMemo(() => {
    let r = staff
    if (posFilter) r = r.filter((s) => s.position === posFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((s) =>
        (
          s.firstName +
          ' ' +
          s.lastName +
          ' ' +
          s.phone +
          ' ' +
          (s.email || '')
        )
          .toLowerCase()
          .includes(q),
      )
    }
    return r
  }, [staff, posFilter, search])

  const totalSalary = staff.reduce((sum, s) => sum + (s.salary || 0), 0)

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      position: 'Помощник воспитателя',
      hireDate: dayjs(),
      salary: 3500,
    })
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
      setSubmitting(true)

      const body = {
        firstName: v.firstName,
        lastName: v.lastName,
        middleName: v.middleName || undefined,
        position: toBackendPosition(v.position),
        phone: v.phone,
        email: v.email || undefined,
        groupId: v.groupId || null,
        salary: Number(v.salary) || 0,
        hireDate: dayjs(v.hireDate).format('YYYY-MM-DD'),
      }

      if (editing) {
        await http.patch(`/v1/staff/${editing.id}`, body)
        message.success('Сотрудник обновлён')
      } else {
        await http.post('/v1/staff', body)
        message.success('Сотрудник добавлен')
      }

      setDrawerOpen(false)
      await loadStaff()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось сохранить сотрудника'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const removeStaff = async (id: string) => {
    try {
      await http.delete(`/v1/staff/${id}`)
      message.success('Сотрудник удалён')
      await loadStaff()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось удалить сотрудника'
      message.error(msg)
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
                options={STAFF_POSITIONS.map((p) => ({ value: p, label: p }))}
              />
            </Col>
          </Row>

          <Table
            rowKey="id"
            loading={loading}
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
                    <Popconfirm
                      title="Удалить сотрудника?"
                      onConfirm={() => removeStaff(s.id)}
                    >
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
        width={isMobile ? '100%' : 460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Отмена</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
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
            <Select options={STAFF_POSITIONS.map((p) => ({ value: p, label: p }))} />
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
