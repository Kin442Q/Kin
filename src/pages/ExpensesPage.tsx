import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Popconfirm,
  App as AntdApp,
  Tooltip,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { PieChart } from 'lucide-react'
import { Column, Pie } from '@ant-design/charts'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { SproutPageHeader } from '../components/sprout'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { formatMoney } from '../lib/format'
import { http } from '../api'
import {
  toBackendCategory,
  toRussianCategory,
  ExpenseCategoryEnum,
} from '../lib/expenseCategoryMap'
import { EXPENSE_CATEGORIES, Expense, ExpenseCategory } from '../types'

interface ExpenseApi {
  id: string
  category: ExpenseCategoryEnum
  description: string
  amount: number | string
  month: string
  groupId: string | null
  createdAt: string
  group?: { id: string; name: string; color: string } | null
}

const { Text, Title } = Typography

interface ExtraIncomeApi {
  id: string
  title: string
  amount: number | string
  month: string
  groupId: string | null
  comment: string | null
  createdAt: string
}

export default function ExpensesPage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)

  const [expensesApi, setExpensesApi] = useState<ExpenseApi[]>([])
  const [extraIncomeApi, setExtraIncomeApi] = useState<ExtraIncomeApi[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [modalOpen, setModalOpen] = useState(false)
  const [incomeModal, setIncomeModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form] = Form.useForm()
  const [incomeForm] = Form.useForm()

  const loadAll = async (m: string) => {
    try {
      setLoading(true)
      const [expRes, incRes] = await Promise.all([
        http.get<ExpenseApi[]>('/v1/expenses', { params: { month: m } }),
        http.get<ExtraIncomeApi[]>('/v1/extra-income', {
          params: { month: m },
        }),
      ])
      setExpensesApi(expRes.data)
      setExtraIncomeApi(incRes.data)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить данные'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const loadExpenses = (m: string) => loadAll(m)

  useEffect(() => {
    loadAll(month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  // Преобразуем API данные в формат, совместимый с UI (русские категории)
  const monthExpenses = useMemo<Expense[]>(
    () =>
      expensesApi.map((e) => ({
        id: e.id,
        category: toRussianCategory(e.category) as ExpenseCategory,
        description: e.description,
        amount: Number(e.amount) || 0,
        month: e.month,
        groupId: e.groupId || undefined,
        createdAt: e.createdAt,
      })),
    [expensesApi],
  )

  const monthExtra = useMemo(
    () =>
      extraIncomeApi.map((e) => ({
        id: e.id,
        title: e.title,
        amount: Number(e.amount) || 0,
        month: e.month,
        groupId: e.groupId || undefined,
        comment: e.comment || undefined,
        createdAt: e.createdAt,
      })),
    [extraIncomeApi],
  )

  const total = monthExpenses.reduce((s, e) => s + e.amount, 0)
  const salaries = monthExpenses
    .filter((e) => e.category === 'Зарплата сотрудников')
    .reduce((s, e) => s + e.amount, 0)
  const taxes = monthExpenses
    .filter((e) => e.category === 'Налоги')
    .reduce((s, e) => s + e.amount, 0)
  const rent = monthExpenses
    .filter((e) => e.category === 'Аренда помещения')
    .reduce((s, e) => s + e.amount, 0)

  const byCategoryData = useMemo(() => {
    const map = new Map<string, number>()
    monthExpenses.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount))
    return Array.from(map.entries()).map(([type, value]) => ({ type, value }))
  }, [monthExpenses])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      month: dayjs(month + '-01'),
      category: 'Прочее',
    })
    setModalOpen(true)
  }

  const openEdit = (e: Expense) => {
    setEditing(e)
    form.setFieldsValue({ ...e, month: dayjs(e.month + '-01') })
    setModalOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const body = {
        category: toBackendCategory(values.category),
        description: values.description,
        amount: Number(values.amount),
        month: dayjs(values.month).format('YYYY-MM'),
        groupId: values.groupId || null,
      }

      if (editing) {
        await http.patch(`/v1/expenses/${editing.id}`, body)
        message.success('Сохранено')
      } else {
        await http.post('/v1/expenses', body)
        message.success('Расход добавлен')
      }

      setModalOpen(false)
      const targetMonth = dayjs(values.month).format('YYYY-MM')
      if (targetMonth === month) {
        await loadExpenses(month)
      } else {
        setMonth(targetMonth)
      }
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось сохранить расход'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const removeExpense = async (id: string) => {
    try {
      await http.delete(`/v1/expenses/${id}`)
      message.success('Удалено')
      await loadExpenses(month)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось удалить расход'
      message.error(msg)
    }
  }

  const submitIncome = async () => {
    try {
      const v = await incomeForm.validateFields()
      setSubmitting(true)
      const targetMonth = dayjs(v.month).format('YYYY-MM')
      await http.post('/v1/extra-income', {
        title: v.title,
        amount: Number(v.amount),
        month: targetMonth,
        groupId: v.groupId || undefined,
        comment: v.comment || undefined,
      })
      setIncomeModal(false)
      message.success('Дополнительный доход добавлен')
      incomeForm.resetFields()
      if (targetMonth === month) {
        await loadAll(month)
      } else {
        setMonth(targetMonth)
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

  return (
    <div>
      <SproutPageHeader
        title="Расходы и доп. доходы"
        icon={<PieChart size={22} strokeWidth={2} />}
        iconAccent="pink"
        description={`Учёт за ${dayjs(month + '-01').format('MMMM YYYY')}`}
        actions={
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(month + '-01')}
              onChange={(d) => d && setMonth(d.format('YYYY-MM'))}
              allowClear={false}
            />
            <Button onClick={() => { incomeForm.setFieldsValue({ month: dayjs(month + '-01') }); setIncomeModal(true) }}>
              + Доход
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Добавить расход
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard title="Расходы месяца" value={total} format="money" variant="warning" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Зарплаты" value={salaries} format="money" variant="primary" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Налоги" value={taxes} format="money" variant="danger" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Аренда" value={rent} format="money" variant="primary" />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={10}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                Структура расходов
              </Title>
              {byCategoryData.length > 0 ? (
                <Pie
                  data={byCategoryData}
                  angleField="value"
                  colorField="type"
                  radius={0.9}
                  innerRadius={0.55}
                  height={280}
                  legend={{ position: 'bottom' }}
                />
              ) : (
                <Text type="secondary">Нет расходов</Text>
              )}
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={14}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                По категориям
              </Title>
              <Column
                data={byCategoryData}
                xField="type"
                yField="value"
                color="#a855f7"
                columnStyle={{ radius: [8, 8, 0, 0] }}
                height={280}
                xAxis={{ label: { autoRotate: true } }}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Card className="glass mt-4" bordered={false}>
        <Title level={5}>Список расходов</Title>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={monthExpenses}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Категория',
              dataIndex: 'category',
              filters: EXPENSE_CATEGORIES.map((c) => ({ text: c, value: c })),
              onFilter: (v, r) => r.category === v,
              render: (v) => <Tag color="purple">{v}</Tag>,
            },
            { title: 'Описание', dataIndex: 'description' },
            {
              title: 'Группа',
              dataIndex: 'groupId',
              render: (v?: string) => {
                if (!v) return <Tag>Общий</Tag>
                const g = groups.find((x) => x.id === v)
                return <Tag color="geekblue">{g?.name || '—'}</Tag>
              },
            },
            {
              title: 'Сумма',
              dataIndex: 'amount',
              sorter: (a, b) => a.amount - b.amount,
              render: (v: number) => <Text strong>{formatMoney(v)}</Text>,
            },
            {
              title: 'Действия',
              key: 'actions',
              render: (_, e: Expense) => (
                <Space>
                  <Tooltip title="Редактировать">
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(e)} />
                  </Tooltip>
                  <Popconfirm
                    title="Удалить?"
                    onConfirm={() => removeExpense(e.id)}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {monthExtra.length > 0 && (
        <Card className="glass mt-4" bordered={false}>
          <Title level={5}>Дополнительные доходы за месяц</Title>
          <Table
            rowKey="id"
            dataSource={monthExtra}
            pagination={false}
            columns={[
              { title: 'Название', dataIndex: 'title' },
              {
                title: 'Группа',
                dataIndex: 'groupId',
                render: (v?: string) => (v ? groups.find((g) => g.id === v)?.name : <Tag>Общий</Tag>),
              },
              { title: 'Сумма', dataIndex: 'amount', render: (v: number) => formatMoney(v) },
              { title: 'Комментарий', dataIndex: 'comment' },
            ]}
          />
        </Card>
      )}

      <Modal
        title={editing ? 'Редактировать расход' : 'Новый расход'}
        open={modalOpen}
        onOk={submit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? 'Сохранить' : 'Добавить'}
        cancelText="Отмена"
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="category" label="Категория" rules={[{ required: true }]}>
            <Select options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="description" label="Описание" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amount" label="Сумма" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="сомони" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="month" label="Месяц" rules={[{ required: true }]}>
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="groupId" label="Группа (если относится к одной группе)">
            <Select
              allowClear
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Дополнительный доход"
        open={incomeModal}
        onOk={submitIncome}
        onCancel={() => setIncomeModal(false)}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={incomeForm}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Например, Кружок «Английский»" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amount" label="Сумма" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="сомони" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="month" label="Месяц" rules={[{ required: true }]}>
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="groupId" label="Группа (если относится к одной)">
            <Select allowClear options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
