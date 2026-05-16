import { useEffect, useMemo, useState } from 'react'
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
import {
  CoffeeOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs, { Dayjs } from 'dayjs'

import { UtensilsCrossed } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
import { http } from '../api'

type MealApi = 'BREAKFAST' | 'LUNCH' | 'SNACK' | 'DINNER'
type MealRu = 'Завтрак' | 'Обед' | 'Полдник' | 'Ужин'

const MEAL_TYPES: MealRu[] = ['Завтрак', 'Обед', 'Полдник', 'Ужин']
const MEAL_COLOR: Record<MealRu, string> = {
  Завтрак: 'gold',
  Обед: 'volcano',
  Полдник: 'cyan',
  Ужин: 'purple',
}

const MEAL_RU_TO_API: Record<MealRu, MealApi> = {
  Завтрак: 'BREAKFAST',
  Обед: 'LUNCH',
  Полдник: 'SNACK',
  Ужин: 'DINNER',
}
const MEAL_API_TO_RU: Record<MealApi, MealRu> = {
  BREAKFAST: 'Завтрак',
  LUNCH: 'Обед',
  SNACK: 'Полдник',
  DINNER: 'Ужин',
}

interface MenuApi {
  id: string
  date: string
  meal: MealApi
  title: string
  description: string | null
  calories: number | null
}

interface UIItem {
  id: string
  date: string
  mealType: MealRu
  dishes: string
}

export default function MenuPage() {
  const { message } = AntdApp.useApp()

  const [items, setItems] = useState<UIItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [date, setDate] = useState<Dayjs>(dayjs())
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    try {
      setLoading(true)
      const res = await http.get<MenuApi[]>('/v1/menu', {
        params: { date: date.format('YYYY-MM-DD') },
      })
      const ui: UIItem[] = res.data.map((m) => ({
        id: m.id,
        date: dayjs(m.date).format('YYYY-MM-DD'),
        mealType: MEAL_API_TO_RU[m.meal],
        dishes: m.title + (m.description ? ` — ${m.description}` : ''),
      }))
      setItems(ui)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить меню'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType),
      ),
    [items],
  )

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)
      await http.post('/v1/menu', {
        date: dayjs(v.date).format('YYYY-MM-DD'),
        meal: MEAL_RU_TO_API[v.mealType as MealRu],
        title: v.dishes,
      })
      setOpen(false)
      form.resetFields()
      message.success('Добавлено')
      // Если выбранная дата совпадает — перезагружаем
      const targetDate = dayjs(v.date).format('YYYY-MM-DD')
      if (targetDate === date.format('YYYY-MM-DD')) {
        await load()
      } else {
        setDate(dayjs(v.date))
      }
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось добавить'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await http.delete(`/v1/menu/${id}`)
      message.success('Удалено')
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
        title="Меню питания"
        icon={<UtensilsCrossed size={22} strokeWidth={2} />}
        iconAccent="mint"
        description={`Меню на ${date.format('DD.MM.YYYY')}`}
        actions={
          <Space>
            <DatePicker
              value={date}
              onChange={(d) => d && setDate(d)}
              allowClear={false}
              format="DD.MM.YYYY"
            />
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
            const it = sorted.find((i) => i.mealType === t)
            return (
              <Col xs={24} md={12} lg={6} key={t}>
                <Card className="glass" bordered={false}>
                  <div className="flex items-center justify-between mb-2">
                    <Tag
                      color={MEAL_COLOR[t]}
                      style={{ fontSize: 13, padding: '4px 10px' }}
                    >
                      {t}
                    </Tag>
                    {it && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(it.id)}
                      />
                    )}
                  </div>
                  <div style={{ minHeight: 80 }}>
                    {it ? (
                      it.dishes
                    ) : (
                      <span className="text-muted">Не задано</span>
                    )}
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>

        <Card className="glass mt-4" bordered={false}>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={sorted}
            pagination={false}
            columns={[
              {
                title: 'Приём пищи',
                dataIndex: 'mealType',
                render: (v: MealRu) => (
                  <Tag color={MEAL_COLOR[v]}>{v}</Tag>
                ),
              },
              { title: 'Блюда', dataIndex: 'dishes' },
              {
                title: '',
                key: 'a',
                render: (_, r) => (
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => remove(r.id)}
                  />
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
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Дата"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="mealType"
                label="Приём пищи"
                rules={[{ required: true }]}
              >
                <Select
                  options={MEAL_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="dishes"
            label="Блюда"
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Например: Каша овсяная, чай с молоком, бутерброд"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
