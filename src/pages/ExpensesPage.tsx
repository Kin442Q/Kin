import { useMemo, useState } from 'react'
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
import { PieChartOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Column, Pie } from '@ant-design/charts'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import PageHeader from '../components/PageHeader'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { formatMoney } from '../lib/format'
import { uid } from '../lib/uid'
import { EXPENSE_CATEGORIES, Expense, ExpenseCategory } from '../types'

const { Text, Title } = Typography

export default function ExpensesPage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const expenses = useDataStore((s) => s.expenses)
  const extraIncome = useDataStore((s) => s.extraIncome)
  const upsertExpense = useDataStore((s) => s.upsertExpense)
  const deleteExpense = useDataStore((s) => s.deleteExpense)
  const upsertExtraIncome = useDataStore((s) => s.upsertExtraIncome)

  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [modalOpen, setModalOpen] = useState(false)
  const [incomeModal, setIncomeModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form] = Form.useForm()
  const [incomeForm] = Form.useForm()

  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.month === month),
    [expenses, month],
  )
  const monthExtra = useMemo(
    () => extraIncome.filter((e) => e.month === month),
    [extraIncome, month],
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
      const data: Expense = {
        id: editing?.id ?? uid(),
        category: values.category as ExpenseCategory,
        description: values.description,
        amount: values.amount,
        month: dayjs(values.month).format('YYYY-MM'),
        groupId: values.groupId || undefined,
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      }
      upsertExpense(data)
      setModalOpen(false)
      message.success(editing ? 'Сохранено' : 'Расход добавлен')
    } catch {
      /* validation */
    }
  }

  const submitIncome = async () => {
    try {
      const v = await incomeForm.validateFields()
      upsertExtraIncome({
        id: uid(),
        title: v.title,
        amount: v.amount,
        month: dayjs(v.month).format('YYYY-MM'),
        groupId: v.groupId,
        comment: v.comment,
        createdAt: new Date().toISOString(),
      })
      setIncomeModal(false)
      message.success('Дополнительный доход добавлен')
      incomeForm.resetFields()
    } catch {
      /* */
    }
  }

  return (
    <div>
      <PageHeader
        title="Расходы и доп. доходы"
        icon={<PieChartOutlined />}
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
                  <Popconfirm title="Удалить?" onConfirm={() => deleteExpense(e.id)}>
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
