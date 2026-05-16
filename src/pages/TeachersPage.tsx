import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  Drawer,
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
  ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'

import { useEffect } from 'react'
import { GraduationCap } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { http } from '../api'

interface TeacherApi {
  id: string
  email: string
  fullName: string
  phone: string | null
  groupId: string | null
  isActive: boolean
  createdAt?: string
}

const { Text } = Typography
const { useBreakpoint } = Grid

/**
 * Регистрация учителей.
 *
 * Доступна только администраторам. Создаёт Account с ролью 'teacher'
 * и привязкой groupId. Дальше учитель логинится по этим
 * email + password и видит только свою группу.
 */
export default function TeachersPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const groups = useDataStore((s) => s.groups)

  const [teachers, setTeachers] = useState<TeacherApi[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<TeacherApi | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // Модалка с учётными данными после создания
  const [credentialsModal, setCredentialsModal] = useState<{
    fullName: string
    phone: string
    password: string
  } | null>(null)

  const generatePassword = () => {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 8; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)]
    }
    form.setFieldsValue({ password: pwd })
  }

  // Загружаем учителей с бекенда
  const loadTeachers = async () => {
    try {
      setLoading(true)
      const res = await http.get<TeacherApi[]>('/v1/users/teachers')
      setTeachers(res.data)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить учителей'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeachers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const openEdit = (t: TeacherApi) => {
    setEditing(t)
    form.setFieldsValue({
      fullName: t.fullName,
      email: t.email,
      phone: t.phone,
      groupId: t.groupId,
      password: '',
    })
    setDrawerOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)

      if (editing) {
        // Обновление
        const body: Record<string, unknown> = {
          fullName: v.fullName.trim(),
          phone: v.phone,
          groupId: v.groupId ?? null,
        }
        if (v.email) body.email = v.email.trim()
        if (v.password) body.password = v.password
        await http.patch(`/v1/users/teacher/${editing.id}`, body)
        message.success('Учётка учителя обновлена')
      } else {
        // Создание
        if (!v.password || v.password.length < 6) {
          message.error('Пароль минимум 6 символов')
          return
        }
        await http.post('/v1/users/teacher', {
          fullName: v.fullName.trim(),
          phone: v.phone,
          email: v.email?.trim() || undefined,
          password: v.password,
          groupId: v.groupId || undefined,
        })
        message.success('Учитель зарегистрирован')
        // Показываем учётные данные админу — последний шанс их увидеть
        setCredentialsModal({
          fullName: v.fullName.trim(),
          phone: v.phone,
          password: v.password,
        })
      }

      setDrawerOpen(false)
      await loadTeachers()
    } catch (err: any) {
      // Если это ошибка валидации формы — пропускаем
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось сохранить учителя'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (t: TeacherApi) => {
    try {
      await http.delete(`/v1/users/teacher/${t.id}`)
      message.success(`Учётка «${t.fullName}» удалена`)
      await loadTeachers()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось удалить учителя'
      message.error(msg)
    }
  }

  return (
    <div>
      <SproutPageHeader
        title="Учителя"
        icon={<GraduationCap size={22} strokeWidth={2} />}
        iconAccent="lilac"
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

          <Table<TeacherApi>
            rowKey="id"
            loading={loading}
            dataSource={list}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 700 }}
            sticky
            columns={[
              {
                title: 'Учитель',
                key: 'fio',
                render: (_, t) => (
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
                render: (groupId?: string | null) => {
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
                render: (v?: string | null) =>
                  v ? (
                    <Text>
                      <PhoneOutlined /> {v}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Статус',
                dataIndex: 'isActive',
                render: (active: boolean) =>
                  active ? (
                    <Tag color="green">Активен</Tag>
                  ) : (
                    <Tag color="red">Заблокирован</Tag>
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
        width={isMobile ? '100%' : 460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Отмена</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
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
                    { min: 6, message: 'Минимум 6 символов' },
                  ]
            }
            extra={
              !editing && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  💡 Сгенерируйте пароль или придумайте свой. После сохранения он будет показан один раз.
                </Text>
              )
            }
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              addonAfter={
                <Tooltip title="Сгенерировать пароль">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={generatePassword}
                    style={{ border: 'none', height: 'auto', padding: '0 4px' }}
                  >
                    Создать
                  </Button>
                </Tooltip>
              }
            />
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
            description="Вы увидите телефон и пароль один раз — обязательно сохраните или передайте учителю."
          />
        </Form>
      </Drawer>

      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#10b981' }} />
            <span>Учётные данные учителя</span>
          </Space>
        }
        open={!!credentialsModal}
        onCancel={() => setCredentialsModal(null)}
        footer={[
          <Button
            key="copy-all"
            icon={<CopyOutlined />}
            onClick={() => {
              if (!credentialsModal) return
              const text =
                `Логин для входа в KinderCRM\n\n` +
                `👨‍🏫 ${credentialsModal.fullName}\n` +
                `📱 Телефон: ${credentialsModal.phone}\n` +
                `🔑 Пароль: ${credentialsModal.password}\n\n` +
                `Выбирайте на странице входа вкладку "Воспитатель".`
              navigator.clipboard.writeText(text)
              message.success('Скопировано в буфер обмена')
            }}
          >
            Скопировать всё
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => setCredentialsModal(null)}
          >
            Готово
          </Button>,
        ]}
        width={isMobile ? '100%' : 480}
      >
        {credentialsModal && (
          <div>
            <Alert
              type="warning"
              showIcon
              message="Сохраните пароль сейчас!"
              description="После закрытия этого окна пароль больше нельзя будет увидеть — только сбросить."
              style={{ marginBottom: 16 }}
            />

            <div
              style={{
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Учитель
                </Text>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {credentialsModal.fullName}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <PhoneOutlined /> Телефон (логин)
                </Text>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 16,
                    fontWeight: 600,
                    background: '#fff',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{credentialsModal.phone}</span>
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.phone)
                      message.success('Телефон скопирован')
                    }}
                  />
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <LockOutlined /> Пароль
                </Text>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 16,
                    fontWeight: 600,
                    background: '#fff',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{credentialsModal.password}</span>
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.password)
                      message.success('Пароль скопирован')
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                color: '#64748b',
                lineHeight: 1.6,
              }}
            >
              <b>Что передать учителю:</b>
              <ol style={{ paddingLeft: 20, margin: '6px 0' }}>
                <li>Открыть страницу входа</li>
                <li>
                  Выбрать вкладку <b>"👨‍🏫 Воспитатель"</b>
                </li>
                <li>Ввести номер телефона и пароль</li>
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
