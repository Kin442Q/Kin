import { uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  ColorPicker,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { BookMarked } from 'lucide-react'
import { motion } from 'framer-motion'

import { SproutPageHeader } from '../components/sprout'
import { http } from '../api'

const { Text } = Typography

interface SubjectDto {
  id: string
  name: string
  color: string
}

export default function SubjectsPage() {
  const { message } = AntdApp.useApp()
  const [items, setItems] = useState<SubjectDto[]>([])
  const [loading, setLoading] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [editing, setEditing] = useState<SubjectDto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await http.get<SubjectDto[]>('/v1/subjects')
      setItems(res.data)
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || uiText("Не удалось загрузить предметы"),
      )
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
    form.setFieldsValue({ color: '#0D7A7C' })
    setDrawer(true)
  }
  const openEdit = (s: SubjectDto) => {
    setEditing(s)
    form.setFieldsValue({ name: s.name, color: s.color })
    setDrawer(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      const color = typeof v.color === 'string' ? v.color : v.color?.toHexString?.()
      setSubmitting(true)
      if (editing) {
        await http.patch(`/v1/subjects/${editing.id}`, {
          name: v.name,
          color,
        })
        message.success(uiText("Предмет обновлён"))
      } else {
        await http.post('/v1/subjects', { name: v.name, color })
        message.success(uiText("Предмет создан"))
      }
      setDrawer(false)
      load()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || uiText("Не удалось сохранить"))
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (s: SubjectDto) => {
    try {
      await http.delete(`/v1/subjects/${s.id}`)
      message.success(uiText("«{0}» удалён", s.name))
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось удалить"))
    }
  }

  return (
    <div>
      <SproutPageHeader
        title={uiText("Предметы")}
        icon={<BookMarked size={22} strokeWidth={2} />}
        iconAccent="cyan"
        description={uiText("Учебные предметы школы. Используются в журнале оценок и в домашних заданиях.")}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {" " + uiText("Новый предмет") + " "}</Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          <Table<SubjectDto>
            rowKey="id"
            loading={loading}
            dataSource={items}
            pagination={{ pageSize: 20 }}
            columns={[
              {
                title: uiText("Название"),
                key: 'name',
                render: (_, s) => (
                  <Space>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: s.color,
                      }}
                    />
                    <Text strong>{s.name}</Text>
                  </Space>
                ),
              },
              {
                title: uiText("Цвет"),
                key: 'color',
                render: (_, s) => <Tag color={s.color}>{s.color}</Tag>,
              },
              {
                title: '',
                key: 'actions',
                width: 100,
                render: (_, s) => (
                  <Space>
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(s)}
                    />
                    <Popconfirm
                      title={uiText("Удалить «{0}»?", s.name)}
                      description={uiText("Все оценки и домашки по предмету удалятся!")}
                      okText={uiText("Удалить")}
                      okButtonProps={{ danger: true }}
                      cancelText={uiText("Отмена")}
                      onConfirm={() => remove(s)}
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
        title={editing ? uiText("Редактировать предмет") : uiText("Новый предмет")}
        width={420}
        open={drawer}
        onClose={() => setDrawer(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawer(false)}>{uiText("Отмена")}</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              {editing ? uiText("Сохранить") : uiText("Создать")}
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="name"
            label={uiText("Название предмета")}
            rules={[{ required: true, message: uiText("Введите название") }]}
          >
            <Input placeholder={uiText("Например, Математика")} />
          </Form.Item>

          <Form.Item label={uiText("Цвет")} name="color">
            <ColorPicker showText format="hex" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
