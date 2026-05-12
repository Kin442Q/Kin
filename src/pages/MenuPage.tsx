import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  App as AntdApp,
} from 'antd'
import { CoffeeOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs, { Dayjs } from 'dayjs'

import PageHeader from '../components/PageHeader'
import { useDataStore } from '../store/dataStore'
import { uid } from '../lib/uid'
import { MealType, MenuItem } from '../types'

const MEAL_TYPES: MealType[] = ['Завтрак', 'Обед', 'Полдник', 'Ужин']
const MEAL_COLOR: Record<MealType, string> = {
  Завтрак: 'gold',
  Обед: 'volcano',
  Полдник: 'cyan',
  Ужин: 'purple',
}

export default function MenuPage() {
  const { message } = AntdApp.useApp()
  const menu = useDataStore((s) => s.menu)
  const upsertMenu = useDataStore((s) => s.upsertMenu)
  const deleteMenu = useDataStore((s) => s.deleteMenu)

  const [date, setDate] = useState<Dayjs>(dayjs())
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const items = useMemo(
    () =>
      menu
        .filter((m) => m.date === date.format('YYYY-MM-DD'))
        .sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType)),
    [menu, date],
  )

  const submit = async () => {
    try {
      const v = await form.validateFields()
      const data: MenuItem = {
        id: uid(),
        date: dayjs(v.date).format('YYYY-MM-DD'),
        mealType: v.mealType,
        dishes: v.dishes,
      }
      upsertMenu(data)
      setOpen(false)
      form.resetFields()
      message.success('Добавлено')
    } catch {
      /* */
    }
  }

  return (
    <div>
      <PageHeader
        title="Меню питания"
        icon={<CoffeeOutlined />}
        description={`Меню на ${date.format('DD.MM.YYYY')}`}
        actions={
          <Space>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} allowClear={false} format="DD.MM.YYYY" />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.setFieldsValue({ date, mealType: 'Завтрак' })
                setOpen(true)
              }}
            >
              Добавить
            </Button>
          </Space>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Row gutter={[16, 16]}>
          {MEAL_TYPES.map((t) => {
            const it = items.find((i) => i.mealType === t)
            return (
              <Col xs={24} md={12} lg={6} key={t}>
                <Card className="glass" bordered={false}>
                  <div className="flex items-center justify-between mb-2">
                    <Tag color={MEAL_COLOR[t]} style={{ fontSize: 13, padding: '4px 10px' }}>
                      {t}
                    </Tag>
                    {it && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => deleteMenu(it.id)}
                      />
                    )}
                  </div>
                  <div style={{ minHeight: 80 }}>{it ? it.dishes : <span className="text-muted">Не задано</span>}</div>
                </Card>
              </Col>
            )
          })}
        </Row>

        <Card className="glass mt-4" bordered={false}>
          <Table
            rowKey="id"
            dataSource={items}
            pagination={false}
            columns={[
              {
                title: 'Приём пищи',
                dataIndex: 'mealType',
                render: (v: MealType) => <Tag color={MEAL_COLOR[v]}>{v}</Tag>,
              },
              { title: 'Блюда', dataIndex: 'dishes' },
              {
                title: '',
                key: 'a',
                render: (_, r) => (
                  <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => deleteMenu(r.id)} />
                ),
              },
            ]}
          />
        </Card>
      </motion.div>

      <Modal
        title="Добавить блюдо в меню"
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="Добавить"
        cancelText="Отмена"
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="date" label="Дата" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mealType" label="Приём пищи" rules={[{ required: true }]}>
                <Select options={MEAL_TYPES.map((t) => ({ value: t, label: t }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dishes" label="Блюда" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Например: Каша овсяная, чай с молоком, бутерброд" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
