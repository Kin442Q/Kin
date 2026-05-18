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
        e?.response?.data?.message || 'Не удалось загрузить предметы',
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
    form.setFieldsValue({ color: '#4FB286' })
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
        message.success('Предмет обновлён')
      } else {
        await http.post('/v1/subjects', { name: v.name, color })
        message.success('Предмет создан')
      }
      setDrawer(false)
      load()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Не удалось сохранить')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (s: SubjectDto) => {
    try {
      await http.delete(`/v1/subjects/${s.id}`)
      message.success(`«${s.name}» удалён`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось удалить')
    }
  }

  return (
    <div>
      <SproutPageHeader
        title="Предметы"
        icon={<BookMarked size={22} strokeWidth={2} />}
        iconAccent="cyan"
        description="Учебные предметы школы. Используются в журнале оценок и в домашних заданиях."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новый предмет
          </Button>
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
                title: 'Название',
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
                title: 'Цвет',
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
                      title={`Удалить «${s.name}»?`}
                      description="Все оценки и домашки по предмету удалятся!"
                      okText="Удалить"
                      okButtonProps={{ danger: true }}
                      cancelText="Отмена"
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
        title={editing ? 'Редактировать предмет' : 'Новый предмет'}
        width={420}
        open={drawer}
        onClose={() => setDrawer(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawer(false)}>Отмена</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="name"
            label="Название предмета"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например, Математика" />
          </Form.Item>

          <Form.Item label="Цвет" name="color">
            <ColorPicker showText format="hex" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
