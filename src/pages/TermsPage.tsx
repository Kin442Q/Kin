import { localizeCopy, uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { CalendarRange } from 'lucide-react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { SproutPageHeader } from '../components/sprout'
import { termsApi, type TermDto, type TermType } from '../api/termsApi'

const { Text } = Typography
const { RangePicker } = DatePicker

const TYPE_LABEL: Record<TermType, string> = localizeCopy({
  QUARTER: 'Четверть',
  TRIMESTER: 'Триместр',
  SEMESTER: 'Полугодие',
})

export default function TermsPage() {
  const { message } = AntdApp.useApp()
  const [items, setItems] = useState<TermDto[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<TermDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      setItems(await termsApi.list())
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось загрузить периоды"))
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
    form.setFieldsValue({ type: 'QUARTER' })
    setModal(true)
  }
  const openEdit = (t: TermDto) => {
    setEditing(t)
    form.setFieldsValue({
      name: t.name,
      type: t.type,
      range: [dayjs(t.startDate), dayjs(t.endDate)],
    })
    setModal(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      const [start, end] = v.range
      setSaving(true)
      const payload = {
        name: v.name.trim(),
        type: v.type as TermType,
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD'),
      }
      if (editing) {
        await termsApi.update(editing.id, payload)
        message.success(uiText("Период обновлён"))
      } else {
        await termsApi.create(payload)
        message.success(uiText("Период создан"))
      }
      setModal(false)
      load()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || uiText("Ошибка сохранения"))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t: TermDto) => {
    try {
      await termsApi.remove(t.id)
      message.success(uiText("Удалено"))
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Ошибка"))
    }
  }

  const now = dayjs()

  return (
    <div>
      <SproutPageHeader
        title={uiText("Учебные периоды")}
        icon={<CalendarRange size={22} strokeWidth={2} />}
        iconAccent="lilac"
        description={uiText("Четверти / триместры / полугодия — по ним группируются оценки в журнале")}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {" " + uiText("Новый период") + " "}</Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          <Table<TermDto>
            rowKey="id"
            loading={loading}
            dataSource={items}
            pagination={false}
            columns={[
              {
                title: uiText("Название"),
                key: 'name',
                render: (_, t) => {
                  const isCurrent =
                    now.isAfter(dayjs(t.startDate).subtract(1, 'day')) &&
                    now.isBefore(dayjs(t.endDate).add(1, 'day'))
                  return (
                    <Space>
                      <Text strong>{t.name}</Text>
                      {isCurrent && <Tag color="green">{uiText("сейчас")}</Tag>}
                    </Space>
                  )
                },
              },
              {
                title: uiText("Тип"),
                dataIndex: 'type',
                render: (v: TermType) => <Tag color="purple">{TYPE_LABEL[v]}</Tag>,
              },
              {
                title: uiText("Период"),
                key: 'range',
                render: (_, t) =>
                  `${dayjs(t.startDate).format('DD.MM.YYYY')} — ${dayjs(t.endDate).format('DD.MM.YYYY')}`,
              },
              {
                title: '',
                key: 'actions',
                width: 100,
                render: (_, t) => (
                  <Space>
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(t)}
                    />
                    <Popconfirm
                      title={uiText("Удалить «{0}»?", t.name)}
                      okText={uiText("Удалить")}
                      okButtonProps={{ danger: true }}
                      cancelText={uiText("Отмена")}
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

      <Modal
        title={editing ? uiText("Редактировать период") : uiText("Новый учебный период")}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={submit}
        okText={editing ? uiText("Сохранить") : uiText("Создать")}
        cancelText={uiText("Отмена")}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="type" label={uiText("Тип периода")} rules={[{ required: true }]}>
            <Segmented
              block
              options={[
                { value: 'QUARTER', label: uiText("Четверть") },
                { value: 'TRIMESTER', label: uiText("Триместр") },
                { value: 'SEMESTER', label: uiText("Полугодие") },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label={uiText("Название")}
            rules={[{ required: true, message: uiText("Введите название") }]}
          >
            <Input placeholder={uiText("Например: 1 четверть")} />
          </Form.Item>
          <Form.Item
            name="range"
            label={uiText("Даты начала и конца")}
            rules={[{ required: true, message: uiText("Укажите период") }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
