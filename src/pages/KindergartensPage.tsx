import { useEffect, useState } from 'react'
import {
  Alert,
  App as AntdApp,
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
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BankOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  KeyOutlined,
  ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'

import { School } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
import { http } from '../api'

const { Text } = Typography
const { useBreakpoint } = Grid

interface KindergartenApi {
  id: string
  slug: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  stats: {
    usersCount: number
    groupsCount: number
    studentsCount: number
  }
}

export default function KindergartensPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [items, setItems] = useState<KindergartenApi[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<KindergartenApi | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // Модалка с учётными данными после создания
  const [credentialsModal, setCredentialsModal] = useState<{
    kindergartenName: string
    ownerName: string
    email: string
    password: string
  } | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await http.get<KindergartenApi[]>('/v1/kindergartens')
      setItems(res.data)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить садики'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const generatePassword = () => {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 10; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)]
    }
    form.setFieldsValue({ ownerPassword: pwd })
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setDrawerOpen(true)
  }

  const openEdit = (k: KindergartenApi) => {
    setEditing(k)
    form.setFieldsValue({
      name: k.name,
      address: k.address,
      phone: k.phone,
    })
    setDrawerOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)

      if (editing) {
        await http.patch(`/v1/kindergartens/${editing.id}`, {
          name: v.name,
          address: v.address || undefined,
          phone: v.phone || undefined,
        })
        message.success('Садик обновлён')
      } else {
        await http.post('/v1/kindergartens', {
          name: v.name,
          address: v.address || undefined,
          phone: v.phone || undefined,
          owner: {
            fullName: v.ownerFullName,
            email: v.ownerEmail.trim().toLowerCase(),
            password: v.ownerPassword,
          },
        })
        setCredentialsModal({
          kindergartenName: v.name,
          ownerName: v.ownerFullName,
          email: v.ownerEmail.trim().toLowerCase(),
          password: v.ownerPassword,
        })
        message.success('Садик создан')
      }

      setDrawerOpen(false)
      await load()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось сохранить'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (k: KindergartenApi) => {
    try {
      await http.delete(`/v1/kindergartens/${k.id}`)
      message.success(`Садик «${k.name}» удалён`)
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
        title="Садики"
        icon={<School size={22} strokeWidth={2} />}
        iconAccent="blue"
        description="Управление всеми садиками платформы. Каждый садик изолирован."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {isMobile ? 'Новый' : 'Новый садик'}
          </Button>
        }
      />

      <Alert
        type="info"
        showIcon
        message="Вы — владелец платформы"
        description="Создавайте новые садики и назначайте им владельцев. У каждого садика своя изолированная база данных."
        style={{ marginBottom: 16 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          <Table<KindergartenApi>
            rowKey="id"
            loading={loading}
            dataSource={items}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 700 }}
            columns={[
              {
                title: 'Садик',
                key: 'name',
                render: (_, k) => (
                  <Space>
                    <Avatar
                      icon={<BankOutlined />}
                      style={{
                        background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{k.name}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        slug: <code>{k.slug}</code>
                      </Text>
                    </div>
                  </Space>
                ),
              },
              {
                title: 'Адрес',
                key: 'address',
                render: (_, k) =>
                  k.address ? (
                    <Text>
                      <EnvironmentOutlined /> {k.address}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Телефон',
                key: 'phone',
                render: (_, k) =>
                  k.phone ? (
                    <Text>
                      <PhoneOutlined /> {k.phone}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Статистика',
                key: 'stats',
                render: (_, k) => (
                  <Space wrap size={4}>
                    <Tag color="blue" icon={<UserOutlined />}>
                      {k.stats.usersCount}
                    </Tag>
                    <Tag color="purple" icon={<AppstoreOutlined />}>
                      {k.stats.groupsCount}
                    </Tag>
                    <Tag color="cyan" icon={<TeamOutlined />}>
                      {k.stats.studentsCount}
                    </Tag>
                  </Space>
                ),
              },
              {
                title: 'Статус',
                dataIndex: 'isActive',
                render: (active: boolean) =>
                  active ? (
                    <Tag color="green">Активен</Tag>
                  ) : (
                    <Tag color="red">Отключён</Tag>
                  ),
              },
              {
                title: '',
                key: 'actions',
                render: (_, k) => (
                  <Space>
                    <Tooltip title="Редактировать">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(k)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={`Удалить «${k.name}»?`}
                      description="Все данные садика (группы, дети, платежи) удалятся безвозвратно!"
                      okText="Удалить"
                      okButtonProps={{ danger: true }}
                      cancelText="Отмена"
                      onConfirm={() => remove(k)}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </motion.div>

      <Drawer
        title={editing ? 'Редактировать садик' : 'Новый садик'}
        width={isMobile ? '100%' : 480}
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
          <Typography.Title level={5}>📍 Информация о садике</Typography.Title>

          <Form.Item
            name="name"
            label="Название садика"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например, Радуга" />
          </Form.Item>

          <Form.Item name="address" label="Адрес">
            <Input prefix={<EnvironmentOutlined />} placeholder="Город, улица" />
          </Form.Item>

          <Form.Item name="phone" label="Телефон">
            <Input prefix={<PhoneOutlined />} placeholder="+992 …" />
          </Form.Item>

          {!editing && (
            <>
              <Typography.Title level={5} style={{ marginTop: 24 }}>
                👤 Первый администратор
              </Typography.Title>

              <Alert
                type="info"
                showIcon
                message="Это будет владелец садика"
                description="Передайте ему email и пароль — он сможет управлять своим садиком."
                style={{ marginBottom: 12 }}
              />

              <Form.Item
                name="ownerFullName"
                label="ФИО владельца"
                rules={[{ required: true, message: 'Введите ФИО' }]}
              >
                <Input placeholder="Например, Шерамардов Кутбиддин" />
              </Form.Item>

              <Form.Item
                name="ownerEmail"
                label="Email"
                rules={[
                  { required: true, message: 'Введите email' },
                  { type: 'email', message: 'Некорректный email' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="owner@example.com" />
              </Form.Item>

              <Form.Item
                name="ownerPassword"
                label="Пароль"
                rules={[
                  { required: true, message: 'Введите пароль' },
                  { min: 6, message: 'Минимум 6 символов' },
                ]}
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💡 Сгенерируйте пароль или придумайте свой. Будет показан один раз.
                  </Text>
                }
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="••••••••"
                  addonAfter={
                    <Tooltip title="Сгенерировать">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={generatePassword}
                        style={{
                          border: 'none',
                          height: 'auto',
                          padding: '0 4px',
                        }}
                      >
                        Создать
                      </Button>
                    </Tooltip>
                  }
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>

      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#10b981' }} />
            <span>Учётные данные владельца садика</span>
          </Space>
        }
        open={!!credentialsModal}
        onCancel={() => setCredentialsModal(null)}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              if (!credentialsModal) return
              const text =
                `KinderCRM — Доступ к садику "${credentialsModal.kindergartenName}"\n\n` +
                `👤 ${credentialsModal.ownerName}\n` +
                `📧 Email: ${credentialsModal.email}\n` +
                `🔑 Пароль: ${credentialsModal.password}\n\n` +
                `На странице входа выберите вкладку "Администратор".`
              navigator.clipboard.writeText(text)
              message.success('Скопировано')
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
        width={isMobile ? '100%' : 500}
      >
        {credentialsModal && (
          <div>
            <Alert
              type="warning"
              showIcon
              message="Сохраните пароль сейчас!"
              description="После закрытия окна пароль увидеть нельзя — только сбросить."
              style={{ marginBottom: 16 }}
            />

            <div
              style={{
                background: 'rgba(99,102,241,0.05)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <Row gutter={[8, 12]}>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <BankOutlined /> Садик
                  </Text>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {credentialsModal.kindergartenName}
                  </div>
                </Col>

                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <UserOutlined /> Владелец
                  </Text>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {credentialsModal.ownerName}
                  </div>
                </Col>

                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <MailOutlined /> Email (логин)
                  </Text>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 14,
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
                    <span>{credentialsModal.email}</span>
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(credentialsModal.email)
                        message.success('Скопировано')
                      }}
                    />
                  </div>
                </Col>

                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <LockOutlined /> Пароль
                  </Text>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 14,
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
                        message.success('Скопировано')
                      }}
                    />
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
