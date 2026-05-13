import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  App as AntdApp,
  Tooltip,
  Alert,
} from 'antd'
import {
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'

import PageHeader from '../components/PageHeader'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { uid } from '../lib/uid'
import type { Account } from '../types'

const { Text } = Typography

/**
 * Регистрация учителей.
 *
 * Доступна только администраторам. Создаёт Account с ролью 'teacher'
 * и привязкой groupId. Дальше учитель логинится по этим
 * email + password и видит только свою группу.
 */
export default function TeachersPage() {
  const { message } = AntdApp.useApp()
  const accounts = useDataStore((s) => s.accounts)
  const groups = useDataStore((s) => s.groups)
  const upsertAccount = useDataStore((s) => s.upsertAccount)
  const deleteAccount = useDataStore((s) => s.deleteAccount)

  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form] = Form.useForm()

  // Только учителя
  const teachers = useMemo(
    () => accounts.filter((a) => a.role === 'teacher'),
    [accounts],
  )

  const list = useMemo(() => {
    let r = teachers
    if (groupFilter) r = r.filter((t) => t.groupId === groupFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((t) =>
        (t.fullName + ' ' + t.email + ' ' + (t.phone || '')).toLowerCase().includes(q),
      )
    }
    return r
  }, [teachers, groupFilter, search])

  /** id групп, у которых уже есть учитель — чтобы при создании выводить статус. */
  const occupiedGroupIds = useMemo(
    () => new Set(teachers.map((t) => t.groupId).filter(Boolean) as string[]),
    [teachers],
  )

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setDrawerOpen(true)
  }

  const openEdit = (t: Account) => {
    setEditing(t)
    form.setFieldsValue({ ...t, password: '' })
    setDrawerOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()

      // Генерируем email из телефона, если не указан
      const email = v.email?.trim() || `teacher-${v.phone.replace(/\D/g, '')}@kindergarten.tj`

      // Email должен быть уникальным
      const emailTaken = accounts.find(
        (a) => a.email.toLowerCase() === email.toLowerCase() && a.id !== editing?.id,
      )
      if (emailTaken) {
        message.error('Этот email уже используется')
        return
      }

      const data: Account = {
        id: editing?.id ?? uid(),
        email,
        password: v.password || editing?.password || 'Teacher123!',
        fullName: v.fullName.trim(),
        role: 'teacher',
        groupId: v.groupId,
        phone: v.phone,
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      }
      upsertAccount(data)
      setDrawerOpen(false)
      message.success(
        editing ? 'Учётка учителя обновлена' : 'Учитель зарегистрирован',
      )
    } catch {
      /* validation */
    }
  }

  const remove = (t: Account) => {
    deleteAccount(t.id)
    message.success(`Учётка «${t.fullName}» удалена`)
  }

  return (
    <div>
      <PageHeader
        title="Учителя"
        icon={<TeamOutlined />}
        description="Регистрация воспитателей и привязка к группам. Доступ — только для администратора."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Зарегистрировать учителя
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}>
          <StatCard
            title="Зарегистрировано учителей"
            value={teachers.length}
            variant="primary"
            icon={<TeamOutlined />}
          />
        </Col>
        <Col xs={12} md={8}>
          <StatCard
            title="Групп с учителем"
            value={occupiedGroupIds.size}
            variant="success"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            title="Групп без учителя"
            value={Math.max(0, groups.length - occupiedGroupIds.size)}
            variant="warning"
          />
        </Col>
      </Row>

      {groups.length === 0 && (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message="Сначала создайте группы"
          description="Учителю нужно назначать группу. Перейдите на страницу «Группы», добавьте группу, затем возвращайтесь сюда."
        />
      )}

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
                placeholder="Поиск по имени, email или телефону"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="Все группы"
                value={groupFilter}
                onChange={setGroupFilter}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Col>
            <Col xs={24} md={4} className="flex items-center">
              <Tag color="purple">Найдено: {list.length}</Tag>
            </Col>
          </Row>

          <Table
            rowKey="id"
            dataSource={list}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 700 }}
            sticky
            columns={[
              {
                title: 'Учитель',
                key: 'fio',
                render: (_, t: Account) => (
                  <Space>
                    <Avatar
                      size={36}
                      style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}
                    >
                      {t.fullName[0]}
                    </Avatar>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.fullName}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <MailOutlined /> {t.email}
                      </Text>
                    </div>
                  </Space>
                ),
              },
              {
                title: 'Группа',
                dataIndex: 'groupId',
                filters: groups.map((g) => ({ text: g.name, value: g.id })),
                onFilter: (v, t) => t.groupId === v,
                render: (groupId?: string) => {
                  if (!groupId) return <Tag color="default">Не назначена</Tag>
                  const g = groups.find((x) => x.id === groupId)
                  if (!g) return <Tag color="red">Удалена</Tag>
                  return (
                    <Tag
                      style={{
                        background: g.color + '22',
                        color: g.color,
                        border: `1px solid ${g.color}55`,
                      }}
                    >
                      {g.name}
                    </Tag>
                  )
                },
              },
              {
                title: 'Телефон',
                dataIndex: 'phone',
                render: (v?: string) =>
                  v ? (
                    <Text>
                      <PhoneOutlined /> {v}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Пароль',
                dataIndex: 'password',
                render: (v: string) => (
                  <Space>
                    <KeyOutlined />
                    <Text copyable={{ text: v }} style={{ fontFamily: 'monospace' }}>
                      ••••••
                    </Text>
                  </Space>
                ),
              },
              {
                title: '',
                key: 'actions',
                render: (_, t) => (
                  <Space>
                    <Tooltip title="Редактировать">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(t)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Удалить учётку?"
                      description="Учитель больше не сможет войти. Дети в группе останутся."
                      okText="Удалить"
                      cancelText="Отмена"
                      onConfirm={() => remove(t)}
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
        title={editing ? 'Редактировать учителя' : 'Регистрация учителя'}
        width={460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Отмена</Button>
            <Button type="primary" onClick={submit}>
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="fullName"
            label="ФИО"
            rules={[{ required: true, message: 'Введите ФИО' }]}
          >
            <Input placeholder="Например, Зарина Аминова" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email (для системы, необязательно)"
            rules={[
              { type: 'email', message: 'Некорректный email' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="example@kg.app" />
          </Form.Item>

          <Form.Item
            name="password"
            label={editing ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
            rules={
              editing
                ? []
                : [
                    { required: true, message: 'Введите пароль' },
                    { min: 4, message: 'Минимум 4 символа' },
                  ]
            }
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
          </Form.Item>

          <Form.Item
            name="groupId"
            label="Группа"
            rules={[{ required: true, message: 'Выберите группу' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Учитель будет видеть только эту группу
              </Text>
            }
          >
            <Select
              placeholder="Выберите группу"
              options={groups.map((g) => ({
                value: g.id,
                label: (
                  <Space>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: g.color,
                      }}
                    />
                    {g.name}
                    {occupiedGroupIds.has(g.id) && (
                      <Tag color="orange" style={{ marginLeft: 6 }}>
                        уже занят
                      </Tag>
                    )}
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Номер телефона (используется для входа)"
            rules={[{ required: true, message: 'Введите номер телефона' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Учитель будет входить по этому номеру и пароля
              </Text>
            }
          >
            <Input prefix={<PhoneOutlined />} placeholder="+992 90 123 45 67" />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="После создания"
            description="Передайте учителю его email и пароль. Он сможет войти и работать только со своей группой."
          />
        </Form>
      </Drawer>
    </div>
  )
}
