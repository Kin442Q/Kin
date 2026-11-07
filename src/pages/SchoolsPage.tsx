import { useEffect, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Drawer,
  Form,
  Grid,
  Input,
  Popconfirm,
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
  PhoneOutlined,
  EnvironmentOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'

import { School } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
import { http } from '../api'
import FeaturesModal from '../components/FeaturesModal'
import AccessResultModal from '../components/AccessResultModal'
import AlertsCheckButton from '../components/AlertsCheckButton'
import type { AccessGrant } from '../api/accessApi'

const { Text } = Typography
const { useBreakpoint } = Grid

/** Ответ POST /v1/kindergartens: директору всегда уходит приглашение со ссылкой, пароля нет. */
interface CreateSchoolResponse {
  kindergarten: { id: string }
  invite: AccessGrant
}

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

/** Приглашение директору школы ещё раз (или ссылка для смены пароля, если он уже входил). */
const resendOwnerInvite = (kindergartenId: string) =>
  http.post<AccessGrant>(`/v1/kindergartens/${kindergartenId}/resend-invite`).then((r) => r.data)

export default function SchoolsPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [items, setItems] = useState<KindergartenApi[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<KindergartenApi | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // Итог приглашения директору: письмо ушло или не ушло (тогда можно отправить ещё раз)
  const [access, setAccess] = useState<{ grant: AccessGrant; kindergartenId: string } | null>(null)

  // Школа, чьи разделы редактируются в модалке
  const [featuresFor, setFeaturesFor] = useState<KindergartenApi | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await http.get<KindergartenApi[]>('/v1/kindergartens')
      setItems(res.data)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить школы'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ phone: '+992 ' })
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
        message.success('Школа обновлена')
      } else {
        const ownerEmail = v.ownerEmail.trim().toLowerCase()
        const res = await http.post<CreateSchoolResponse>('/v1/kindergartens', {
          name: v.name,
          address: v.address || undefined,
          phone: v.phone || undefined,
          // Пароль не задаётся: директору уйдёт письмо со ссылкой, и он придумает его сам.
          owner: { fullName: v.ownerFullName, email: ownerEmail },
        })
        const created = res.data
        if (created?.invite && created.kindergarten?.id) {
          setAccess({ grant: created.invite, kindergartenId: created.kindergarten.id })
        }
        message.success('Школа создана')
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

  const resendInvite = async (k: KindergartenApi) => {
    try {
      const grant = await resendOwnerInvite(k.id)
      setAccess({ grant, kindergartenId: k.id })
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Не удалось отправить письмо')
    }
  }

  const remove = async (k: KindergartenApi) => {
    try {
      await http.delete(`/v1/kindergartens/${k.id}`)
      message.success(`«${k.name}» удалено`)
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
        title="Школы"
        icon={<School size={22} strokeWidth={2} />}
        iconAccent="blue"
        description="Управление всеми школами платформы. Каждая школа изолирована: свои классы, ученики и данные."
        actions={
          <Space wrap>
            <AlertsCheckButton />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {isMobile ? 'Новая' : 'Новая школа'}
            </Button>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        message="Вы — владелец платформы"
        description="Создавайте школы и назначайте им директоров. Разделами каждой школы (кнопка «Разделы» в строке) вы управляете сами."
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
                title: 'Название',
                key: 'name',
                render: (_, k) => (
                  <Space>
                    <Avatar
                      icon={<BankOutlined />}
                      style={{ background: 'linear-gradient(135deg,#3B8FBF,#3B8FBF)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {k.name}
                      </div>
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
                    <Tooltip title="Разделы">
                      <Button
                        size="small"
                        type="text"
                        icon={<AppstoreOutlined />}
                        onClick={() => setFeaturesFor(k)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Отправить директору ссылку?"
                      description="Директору уйдёт письмо со ссылкой: он сам задаст пароль. Вам пароль не показывается."
                      okText="Отправить"
                      cancelText="Отмена"
                      onConfirm={() => resendInvite(k)}
                    >
                      <Tooltip title="Отправить директору ссылку для пароля">
                        <Button
                          size="small"
                          type="text"
                          icon={<SendOutlined />}
                          aria-label="Отправить директору ссылку для пароля"
                        />
                      </Tooltip>
                    </Popconfirm>
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
                      description="Все данные школы (классы, ученики, оценки, домашние задания, платежи) удалятся безвозвратно!"
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
        title={editing ? 'Редактировать школу' : 'Новая школа'}
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
          <Typography.Title level={5}>📍 Информация о школе</Typography.Title>

          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input
              placeholder="Например, Школа №42"
            />
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
                message="Это будет директор школы"
                description="Ему придёт письмо со ссылкой на 48 часов: по ней он сам придумает пароль и войдёт. Пароль вы не задаёте, не видите и не передаёте."
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

            </>
          )}
        </Form>
      </Drawer>

      <AccessResultModal
        grant={access?.grant ?? null}
        onRetry={access ? () => resendOwnerInvite(access.kindergartenId) : undefined}
        onClose={() => setAccess(null)}
      />

      <FeaturesModal school={featuresFor} onClose={() => setFeaturesFor(null)} />
    </div>
  )
}
