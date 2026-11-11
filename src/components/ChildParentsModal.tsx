import { uiText } from '../i18n/uiText'
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
  KeyOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons'

import { http } from '../api'
import { accessApi, type AccessGrant } from '../api/accessApi'
import AccessResultModal from './AccessResultModal'

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
  // Итог выдачи доступа: письмо ушло или не ушло (тогда можно отправить ещё раз)
  const [access, setAccess] = useState<{ grant: AccessGrant; userId: string } | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await http.get<ParentDto[]>(`/v1/students/${childId}/parents`)
      setParents(res.data)
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || uiText("Не удалось загрузить родителей"),
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

  const submit = async () => {
    try {
      const v = await form.validateFields()
      if (!childId) return
      setSubmitting(true)
      const email = v.email.trim().toLowerCase()
      // «+992 » без цифр — это пустое поле, а не номер
      const rawPhone = v.phone?.trim()
      const phone = rawPhone && rawPhone.replace(/\D/g, '').length > 3 ? rawPhone : undefined
      const res = await http.post<{ id?: string; access?: AccessGrant }>(`/v1/students/${childId}/parents`, {
        fullName: v.fullName.trim(),
        email,
        phone,
      })
      if (res.data?.access && res.data.id) {
        setAccess({ grant: res.data.access, userId: res.data.id })
      }
      setShowForm(false)
      form.resetFields()
      await load()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(
        e?.response?.data?.message || uiText("Не удалось создать родителя"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const sendLink = async (p: ParentDto) => {
    try {
      const grant = await accessApi.sendLink(p.id)
      setAccess({ grant, userId: p.id })
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось отправить письмо"))
    }
  }

  const remove = async (parentId: string) => {
    if (!childId) return
    try {
      await http.delete(`/v1/students/${childId}/parents/${parentId}`)
      message.success(uiText("Родитель отвязан от ребёнка"))
      await load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось отвязать"))
    }
  }

  return (
    <>
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>{uiText("Родители ребёнка:") + " "}{childName}</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        footer={[
          <Button key="close" onClick={onClose}>
            {" " + uiText("Закрыть") + " "}</Button>,
        ]}
        width={620}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message={uiText("У ребёнка может быть несколько родительских аккаунтов")}
          description={uiText("Каждый родитель получит доступ только к своему ребёнку: посещаемость, оплаты, оценки, дневник.")}
          style={{ marginBottom: 16 }}
        />

        <List
          loading={loading}
          dataSource={parents}
          locale={{ emptyText: uiText("Родительских аккаунтов пока нет") }}
          renderItem={(p) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="link"
                  title={uiText("Отправить ссылку для пароля?")}
                  description={uiText("Родителю уйдёт письмо со ссылкой: он сам задаст новый пароль. Вам пароль не показывается.")}
                  okText={uiText("Отправить")}
                  cancelText={uiText("Отмена")}
                  disabled={/\.local$/i.test(p.email)}
                  onConfirm={() => sendLink(p)}
                >
                  <Tooltip title={/\.local$/i.test(p.email) ? uiText("У родителя не указан email") : uiText("Отправить ссылку для пароля")}>
                    <Button
                      size="small"
                      type="text"
                      icon={<KeyOutlined />}
                      aria-label={uiText("Отправить ссылку для пароля")}
                      disabled={/\.local$/i.test(p.email)}
                    />
                  </Tooltip>
                </Popconfirm>,
                <Popconfirm
                  key="del"
                  title={uiText("Отвязать родителя?")}
                  description={uiText("Аккаунт сохранится, но потеряет доступ к этому ребёнку.")}
                  okText={uiText("Отвязать")}
                  cancelText={uiText("Отмена")}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(p.id)}
                >
                  <Tooltip title={uiText("Отвязать")}>
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
                        ? 'linear-gradient(135deg,#0D7A7C,#3B8FBF)'
                        : '#999',
                    }}
                  />
                }
                title={
                  <Space>
                    <Text strong>{p.fullName}</Text>
                    {!p.isActive && <Tag>{uiText("заблокирован")}</Tag>}
                  </Space>
                }
                description={
                  <Space size="small">
                    {!/\.local$/i.test(p.email) && (
                      <>
                        <MailOutlined /> <Text>{p.email}</Text>
                      </>
                    )}
                    {p.phone && (
                      <>
                        {!/\.local$/i.test(p.email) && '·'} <PhoneOutlined /> <Text>{p.phone}</Text>
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
              form.setFieldsValue({ phone: '+992 ' })
            }}
            style={{ marginTop: 8 }}
          >
            {" " + uiText("Добавить родителя") + " "}</Button>
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
              {" " + uiText("Новый родительский аккаунт") + " "}</Typography.Title>
            <Form layout="vertical" form={form}>
              <Form.Item
                name="fullName"
                label={uiText("ФИО родителя")}
                rules={[{ required: true, message: uiText("Укажите ФИО") }]}
              >
                <Input placeholder={uiText("Например, Иванова Мария Петровна")} />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                extra={uiText("На этот адрес придёт письмо со ссылкой: родитель сам придумает пароль. Пароль вы не задаёте и не видите.")}
                rules={[
                  { required: true, message: uiText("Укажите email: на него придёт приглашение") },
                  { type: 'email', message: uiText("Некорректный email") },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="parent@example.com" />
              </Form.Item>

              <Form.Item name="phone" label={uiText("Телефон (необязательно)")}>
                <Input prefix={<PhoneOutlined />} placeholder="+992 ..." />
              </Form.Item>

              <Space>
                <Button type="primary" loading={submitting} onClick={submit}>
                  {" " + uiText("Создать и привязать") + " "}</Button>
                <Button onClick={() => setShowForm(false)}>{uiText("Отмена")}</Button>
              </Space>
            </Form>
          </div>
        )}
      </Modal>

      <AccessResultModal
        grant={access?.grant ?? null}
        onRetry={access ? () => accessApi.sendLink(access.userId) : undefined}
        onClose={() => setAccess(null)}
      />
    </>
  )
}
