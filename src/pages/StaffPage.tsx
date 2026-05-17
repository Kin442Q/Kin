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
  Switch,
  Segmented,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  PhoneOutlined,
  MailOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { Users } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
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

// Все должности доступны на этой странице
// При position='Воспитатель' автоматически предлагается создать учётку для входа
const STAFF_POSITIONS = POSITIONS

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
  userId: string | null
  user: {
    id: string
    email: string
    role: 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN'
    isActive: boolean
    salaryMode: 'HOURLY' | 'FIXED'
    hourlyRate: number | null
    monthlySalaryFixed: number | null
    workNorm: number
    terminalCode: string | null
  } | null
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
      canLogin: false,
      role: 'TEACHER',
      salaryMode: 'HOURLY',
      workNorm: 176,
    })
    setDrawerOpen(true)
  }

  const openEdit = (s: Staff) => {
    setEditing(s)
    // Подтягиваем связанную учётку (user) из staffApi, если есть
    const apiRow = staffApi.find((row) => row.id === s.id)
    const u = apiRow?.user
    form.setFieldsValue({
      ...s,
      hireDate: dayjs(s.hireDate),
      canLogin: !!apiRow?.userId,
      role: u?.role || 'TEACHER',
      salaryMode: u?.salaryMode || 'HOURLY',
      hourlyRate: u?.hourlyRate ?? undefined,
      monthlySalaryFixed: u?.monthlySalaryFixed ?? undefined,
      workNorm: u?.workNorm ?? 176,
      terminalCode: u?.terminalCode ?? '',
    })
    setDrawerOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)

      const body: Record<string, unknown> = {
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

      // Если включена учётка для входа — добавляем поля логина и зарплаты
      if (v.canLogin) {
        body.canLogin = true
        body.role = v.role || 'TEACHER'
        if (v.password) body.password = v.password
        body.salaryMode = v.salaryMode || 'HOURLY'
        if (v.hourlyRate !== undefined && v.hourlyRate !== null)
          body.hourlyRate = Number(v.hourlyRate)
        if (v.monthlySalaryFixed !== undefined && v.monthlySalaryFixed !== null)
          body.monthlySalaryFixed = Number(v.monthlySalaryFixed)
        body.workNorm = Number(v.workNorm) || 176
        if (v.terminalCode) body.terminalCode = v.terminalCode
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
      <SproutPageHeader
        title="Сотрудники"
        icon={<Users size={22} strokeWidth={2} />}
        iconAccent="mint"
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
                render: (_, s: Staff) => {
                  const apiRow = staffApi.find((r) => r.id === s.id)
                  const hasLogin = !!apiRow?.userId
                  return (
                    <Space>
                      <Avatar
                        size={36}
                        style={{
                          background: 'linear-gradient(135deg,#4FB286,#2F8862)',
                        }}
                      >
                        {s.firstName[0]}
                      </Avatar>
                      <div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {s.lastName} {s.firstName}
                          {hasLogin && (
                            <Tooltip title="Может входить в систему">
                              <Tag
                                style={{
                                  background: '#D8EFE3',
                                  color: '#2F8862',
                                  border: 'none',
                                  fontSize: 10,
                                  margin: 0,
                                }}
                              >
                                🔑 вход
                              </Tag>
                            </Tooltip>
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          с {formatDate(s.hireDate)}
                        </Text>
                      </div>
                    </Space>
                  )
                },
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
        <Form
          layout="vertical"
          form={form}
          onValuesChange={(changed) => {
            // Если выбрали Воспитателя — автоматически предлагаем учётку
            if (
              changed.position === 'Воспитатель' &&
              !form.getFieldValue('canLogin')
            ) {
              form.setFieldsValue({ canLogin: true })
            }
          }}
        >
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
            <Select
              allowClear
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              placeholder="Выберите группу"
            />
          </Form.Item>
          <Form.Item name="phone" label="Телефон" rules={[{ required: true }]}>
            <Input prefix={<PhoneOutlined />} placeholder="+992 ..." />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input prefix={<MailOutlined />} placeholder="optional@example.com" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="salary" label="Базовая зарплата">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="сом" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hireDate" label="Дата найма" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>

          {/* ─── Раздел: учётная запись для входа в систему ─── */}
          <Divider style={{ margin: '8px 0 14px' }}>
            <LockOutlined /> Учётная запись
          </Divider>
          <Form.Item
            name="canLogin"
            label="Может входить в систему"
            valuePropName="checked"
            tooltip="Включите, если сотрудник должен иметь логин (для воспитателей — обязательно)"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            shouldUpdate={(prev, cur) => prev.canLogin !== cur.canLogin}
            noStyle
          >
            {({ getFieldValue }) =>
              getFieldValue('canLogin') ? (
                <>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="role"
                        label="Роль"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { value: 'TEACHER', label: '👨‍🏫 Воспитатель' },
                            { value: 'ADMIN', label: '👤 Администратор' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="password"
                        label={editing ? 'Новый пароль (опц.)' : 'Пароль'}
                        rules={
                          editing
                            ? []
                            : [
                                { required: true, message: 'Введите пароль' },
                                { min: 6, message: 'Минимум 6 символов' },
                              ]
                        }
                      >
                        <Input.Password placeholder="Минимум 6 символов" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '8px 0 14px' }} orientation="left">
                    Зарплата (для табеля)
                  </Divider>
                  <Form.Item name="salaryMode" label="Режим оплаты">
                    <Segmented
                      block
                      options={[
                        { label: '⏱ Почасовая', value: 'HOURLY' },
                        { label: '💼 Фикс. оклад', value: 'FIXED' },
                      ]}
                    />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="hourlyRate" label="Ставка в час">
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          addonAfter="сом/ч"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="monthlySalaryFixed" label="Фикс. оклад">
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          addonAfter="сом/мес"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="workNorm" label="Норма часов/мес">
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          addonAfter="ч"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="terminalCode"
                        label="Код терминала"
                        tooltip="Код сотрудника на физическом терминале Face-ID"
                      >
                        <Input placeholder="T001" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
