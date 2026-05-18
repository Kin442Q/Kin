import { useEffect, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons'

import { http } from '../api'

const { Text } = Typography

interface ParentDto {
  id: string
  fullName: string
  email: string
  phone: string | null
  isActive: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  childId: string | null
  childName: string
}

export default function ChildParentsModal({
  open,
  onClose,
  childId,
  childName,
}: Props) {
  const { message } = AntdApp.useApp()
  const [parents, setParents] = useState<ParentDto[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [credentialsModal, setCredentialsModal] = useState<{
    fullName: string
    email: string
    password: string
  } | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await http.get<ParentDto[]>(`/v1/students/${childId}/parents`)
      setParents(res.data)
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || 'Не удалось загрузить родителей',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && childId) {
      load()
      setShowForm(false)
      form.resetFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, childId])

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 10; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)]
    }
    form.setFieldsValue({ password: pwd })
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      if (!childId) return
      setSubmitting(true)
      await http.post(`/v1/students/${childId}/parents`, {
        fullName: v.fullName,
        email: v.email?.trim().toLowerCase(),
        phone: v.phone || undefined,
        password: v.password,
      })
      setCredentialsModal({
        fullName: v.fullName,
        email: v.email?.trim().toLowerCase() ?? '',
        password: v.password,
      })
      setShowForm(false)
      form.resetFields()
      await load()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(
        e?.response?.data?.message || 'Не удалось создать родителя',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (parentId: string) => {
    if (!childId) return
    try {
      await http.delete(`/v1/students/${childId}/parents/${parentId}`)
      message.success('Родитель отвязан от ребёнка')
      await load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось отвязать')
    }
  }

  return (
    <>
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>Родители ребёнка: {childName}</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        footer={[
          <Button key="close" onClick={onClose}>
            Закрыть
          </Button>,
        ]}
        width={620}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="У ребёнка может быть несколько родительских аккаунтов"
          description="Каждый родитель получит доступ только к своему ребёнку: посещаемость, оплаты, оценки, дневник."
          style={{ marginBottom: 16 }}
        />

        <List
          loading={loading}
          dataSource={parents}
          locale={{ emptyText: 'Родительских аккаунтов пока нет' }}
          renderItem={(p) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="Отвязать родителя?"
                  description="Аккаунт сохранится, но потеряет доступ к этому ребёнку."
                  okText="Отвязать"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(p.id)}
                >
                  <Tooltip title="Отвязать">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={<UserOutlined />}
                    style={{
                      background: p.isActive
                        ? 'linear-gradient(135deg,#4FB286,#5BA9D1)'
                        : '#999',
                    }}
                  />
                }
                title={
                  <Space>
                    <Text strong>{p.fullName}</Text>
                    {!p.isActive && <Tag>заблокирован</Tag>}
                  </Space>
                }
                description={
                  <Space size="small">
                    <MailOutlined /> <Text>{p.email}</Text>
                    {p.phone && (
                      <>
                        · <PhoneOutlined /> <Text>{p.phone}</Text>
                      </>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />

        {!showForm ? (
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => {
              setShowForm(true)
              form.resetFields()
              generatePassword()
            }}
            style={{ marginTop: 8 }}
          >
            Добавить родителя
          </Button>
        ) : (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: 'rgba(79,178,134,0.05)',
              border: '1px solid rgba(79,178,134,0.2)',
              borderRadius: 12,
            }}
          >
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Новый родительский аккаунт
            </Typography.Title>
            <Form layout="vertical" form={form}>
              <Form.Item
                name="fullName"
                label="ФИО родителя"
                rules={[{ required: true, message: 'Укажите ФИО' }]}
              >
                <Input placeholder="Например, Иванова Мария Петровна" />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Укажите email' },
                  { type: 'email', message: 'Некорректный email' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="parent@example.com" />
              </Form.Item>

              <Form.Item name="phone" label="Телефон (необязательно)">
                <Input prefix={<PhoneOutlined />} placeholder="+992 ..." />
              </Form.Item>

              <Form.Item
                name="password"
                label="Пароль"
                rules={[
                  { required: true, message: 'Укажите пароль' },
                  { min: 6, message: 'Минимум 6 символов' },
                ]}
                extra="Будет показан один раз после создания"
              >
                <Input.Password
                  addonAfter={
                    <Tooltip title="Сгенерировать новый">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={generatePassword}
                      >
                        Создать
                      </Button>
                    </Tooltip>
                  }
                />
              </Form.Item>

              <Space>
                <Button type="primary" loading={submitting} onClick={submit}>
                  Создать и привязать
                </Button>
                <Button onClick={() => setShowForm(false)}>Отмена</Button>
              </Space>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="✅ Учётные данные родителя"
        open={!!credentialsModal}
        onCancel={() => setCredentialsModal(null)}
        footer={[
          <Button
            key="copy"
            onClick={() => {
              if (!credentialsModal) return
              const text =
                `redi — Доступ родителя\n\n` +
                `👤 ${credentialsModal.fullName}\n` +
                `📧 ${credentialsModal.email}\n` +
                `🔑 ${credentialsModal.password}\n\n` +
                `Зайти можно в веб-версии или в мобильном приложении.`
              navigator.clipboard.writeText(text)
              message.success('Скопировано')
            }}
          >
            Скопировать
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => setCredentialsModal(null)}
          >
            Готово
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          message="Сохраните пароль сейчас!"
          description="После закрытия пароль увидеть нельзя — только сбросить."
          style={{ marginBottom: 14 }}
        />
        {credentialsModal && (
          <div>
            <p>
              <Text strong>{credentialsModal.fullName}</Text>
            </p>
            <p>
              <MailOutlined /> <Text copyable>{credentialsModal.email}</Text>
            </p>
            <p>
              🔑 <Text copyable>{credentialsModal.password}</Text>
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
