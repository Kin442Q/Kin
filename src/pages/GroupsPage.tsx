import { useMemo, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Avatar,
  Select,
  DatePicker,
  App as AntdApp,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { LayoutGrid, TrendingUp, Wallet } from 'lucide-react'
import { Column, Pie } from '@ant-design/charts'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

import {
  SP,
  SproutPageHeader,
  SproutCard,
  SproutKPI,
  SproutEmpty,
} from '../components/sprout'
import { useDataStore } from '../store/dataStore'
import { refreshTenantData } from '../hooks/useTenantSync'
import { http } from '../api'
import type { Group, GroupFinance } from '../types'
import { calcGroupFinances } from '../lib/finance'
import { formatMoney, formatMoneyCompact, formatPercent } from '../lib/format'

// Sprout-палитра для группы
const GROUP_COLORS = [
  '#4FB286', // mint
  '#5BA9D1', // blue
  '#E5B43A', // yellow
  '#9B7BD4', // lilac
  '#E48979', // rose
  '#D88EAE', // pink
  '#3FA8B3', // cyan
  '#2F8862', // mint deep
]

export default function GroupsPage() {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const payments = useDataStore((s) => s.payments)
  const expenses = useDataStore((s) => s.expenses)
  const extraIncome = useDataStore((s) => s.extraIncome)
  const attendance = useDataStore((s) => s.attendance)
  const staff = useDataStore((s) => s.staff)

  const [month, setMonth] = useState<string>(dayjs().format('YYYY-MM'))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const finances = useMemo<GroupFinance[]>(
    () =>
      calcGroupFinances({
        groups,
        children,
        payments,
        expenses,
        extraIncome,
        attendance,
        month,
      }),
    [groups, children, payments, expenses, extraIncome, attendance, month],
  )

  const total = useMemo(() => {
    const income = finances.reduce((s, g) => s + g.income, 0)
    const exp = finances.reduce((s, g) => s + g.expenses, 0)
    const profit = income - exp
    const profitable = finances.filter((g) => g.profit >= 0).length
    return { income, exp, profit, profitable, count: finances.length }
  }, [finances])

  const incomeShare = finances
    .filter((g) => g.income > 0)
    .map((g) => ({ type: g.group.name, value: g.income }))

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      monthlyFee: 1200,
      fixedMonthlyExpense: 6000,
    })
    setModalOpen(true)
  }

  const openEdit = (g: Group) => {
    setEditing(g)
    form.setFieldsValue(g)
    setModalOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const body = {
        name: values.name,
        ageRange: values.ageRange,
        monthlyFee: Number(values.monthlyFee || 0),
        fixedMonthlyExpense: Number(values.fixedMonthlyExpense || 0),
        color: values.color || GROUP_COLORS[0],
      }

      if (editing) {
        await http.patch(`/v1/groups/${editing.id}`, body)
        message.success('Группа обновлена')
      } else {
        await http.post('/v1/groups', body)
        message.success('Группа создана')
      }

      setModalOpen(false)
      refreshTenantData()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось сохранить группу'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (g: Group) => {
    try {
      await http.delete(`/v1/groups/${g.id}`)
      message.success(`Группа «${g.name}» удалена`)
      refreshTenantData()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось удалить группу'
      message.error(msg)
    }
  }

  const columns = [
    {
      title: 'Группа',
      key: 'name',
      render: (_: unknown, row: GroupFinance) => (
        <Space>
          <Avatar
            style={{
              background: row.group.color,
              color: 'white',
              fontWeight: 700,
            }}
          >
            {row.group.name.slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: SP.text }}>{row.group.name}</div>
            <span style={{ color: SP.muted, fontSize: 12 }}>{row.group.ageRange}</span>
          </div>
        </Space>
      ),
      fixed: 'left' as const,
    },
    {
      title: 'Детей',
      dataIndex: 'childrenCount',
      key: 'childrenCount',
      sorter: (a: GroupFinance, b: GroupFinance) => a.childrenCount - b.childrenCount,
      render: (v: number) => (
        <Tag style={{ background: SP.blueSoft, color: SP.blueDeep, border: 'none', fontWeight: 600 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Оплатили',
      dataIndex: 'paidCount',
      key: 'paidCount',
      render: (v: number, row: GroupFinance) => (
        <Tooltip title={`${v} из ${row.childrenCount}`}>
          <Tag style={{ background: SP.primaryGhost, color: SP.primaryDeep, border: 'none', fontWeight: 600 }}>
            {v}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Должники',
      dataIndex: 'debtorsCount',
      key: 'debtorsCount',
      render: (v: number) =>
        v > 0 ? (
          <Tag style={{ background: '#FCEAE5', color: SP.danger, border: 'none', fontWeight: 600 }}>
            {v}
          </Tag>
        ) : (
          <Tag style={{ background: SP.borderSoft, color: SP.muted, border: 'none' }}>0</Tag>
        ),
    },
    {
      title: 'Доход',
      dataIndex: 'income',
      key: 'income',
      sorter: (a: GroupFinance, b: GroupFinance) => a.income - b.income,
      render: (v: number) => (
        <span className="sp-num" style={{ fontWeight: 600 }}>
          {formatMoneyCompact(v)}
        </span>
      ),
    },
    {
      title: 'Расход',
      dataIndex: 'expenses',
      key: 'expenses',
      sorter: (a: GroupFinance, b: GroupFinance) => a.expenses - b.expenses,
      render: (v: number) => (
        <span className="sp-num" style={{ color: SP.muted }}>
          {formatMoneyCompact(v)}
        </span>
      ),
    },
    {
      title: 'Прибыль',
      dataIndex: 'profit',
      key: 'profit',
      sorter: (a: GroupFinance, b: GroupFinance) => a.profit - b.profit,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => (
        <Tag
          style={{
            background: v >= 0 ? SP.primaryGhost : '#FCEAE5',
            color: v >= 0 ? SP.primaryDeep : SP.danger,
            border: 'none',
            fontWeight: 700,
          }}
        >
          {v >= 0 ? '+' : ''}
          {formatMoneyCompact(v)}
        </Tag>
      ),
    },
    {
      title: 'Маржа',
      dataIndex: 'margin',
      key: 'margin',
      render: (v: number, row: GroupFinance) => (
        <div style={{ minWidth: 110 }}>
          <Progress
            percent={Math.max(0, Math.min(100, v * 100))}
            size="small"
            strokeColor={row.profit >= 0 ? SP.primary : SP.danger}
            format={() => (
              <span style={{ fontSize: 11, color: SP.textMid }}>{formatPercent(v)}</span>
            )}
          />
        </div>
      ),
    },
    {
      title: 'Посещаемость',
      dataIndex: 'attendanceRate',
      key: 'attendanceRate',
      render: (v: number) => (
        <div style={{ minWidth: 110 }}>
          <Progress
            percent={Math.round(v * 100)}
            size="small"
            strokeColor={SP.primary}
            format={(p) => <span style={{ fontSize: 11, color: SP.textMid }}>{p}%</span>}
          />
        </div>
      ),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right' as const,
      render: (_: unknown, row: GroupFinance) => (
        <Space>
          <Tooltip title="Открыть">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/groups/${row.group.id}`)}
            />
          </Tooltip>
          <Tooltip title="Редактировать">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEdit(row.group)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить группу?"
            description="Дети группы останутся, но будут без группы"
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(row.group)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <SproutPageHeader
        title="Группы"
        icon={<LayoutGrid size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description="Финансовая статистика по каждой группе — сразу видно, какая прибыльная"
        actions={
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(month + '-01')}
              onChange={(d) => d && setMonth(d.format('YYYY-MM'))}
              allowClear={false}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Новая группа
            </Button>
          </Space>
        }
      />

      {/* KPI */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Всего групп"
            value={String(total.count)}
            accent="mint"
            icon={<LayoutGrid size={18} strokeWidth={2} />}
            delay={0}
          />
        </Col>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Доход всех групп"
            value={formatMoneyCompact(total.income)}
            accent="mint"
            icon={<Wallet size={18} strokeWidth={2} />}
            delay={0.05}
          />
        </Col>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Расходы всех групп"
            value={formatMoneyCompact(total.exp)}
            accent="yellow"
            icon={<TrendingUp size={18} strokeWidth={2} />}
            delay={0.1}
          />
        </Col>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Чистая прибыль"
            value={`${total.profit >= 0 ? '+' : ''}${formatMoneyCompact(total.profit)}`}
            accent={total.profit >= 0 ? 'mint' : 'rose'}
            hint={`Выгодных: ${total.profitable} / ${total.count}`}
            icon={<TrendingUp size={18} strokeWidth={2} />}
            delay={0.15}
          />
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={16} style={{ display: 'flex' }}>
          <SproutCard style={{ width: '100%' }} delay={0.2}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>
                Прибыль по группам
              </div>
              <Tag
                style={{
                  background: SP.lilacSoft,
                  color: SP.lilacDeep,
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                выгодность
              </Tag>
            </div>
            {finances.length > 0 ? (
              <Column
                data={finances.map((g) => ({
                  group: g.group.name,
                  value: g.profit,
                  type: g.profit >= 0 ? 'Прибыль' : 'Убыток',
                }))}
                xField="group"
                yField="value"
                seriesField="type"
                color={({ type }: { type: string }) =>
                  type === 'Прибыль' ? SP.primary : SP.danger
                }
                columnStyle={{ radius: [10, 10, 0, 0] }}
                height={280}
                label={{
                  position: 'top',
                  formatter: (d: { value: number }) => formatMoneyCompact(d.value),
                  style: { fontSize: 11, fill: SP.muted },
                }}
                legend={{ position: 'top-right' }}
              />
            ) : (
              <SproutEmpty title="Нет данных за выбранный месяц" minHeight={240} />
            )}
          </SproutCard>
        </Col>

        <Col xs={24} lg={8} style={{ display: 'flex' }}>
          <SproutCard style={{ width: '100%' }} delay={0.25}>
            <div style={{ fontSize: 15, fontWeight: 700, color: SP.text, marginBottom: 12 }}>
              Доля группы в доходе
            </div>
            {incomeShare.length > 0 ? (
              <Pie
                data={incomeShare}
                angleField="value"
                colorField="type"
                radius={0.9}
                innerRadius={0.55}
                height={260}
                legend={{ position: 'bottom' }}
                color={GROUP_COLORS}
              />
            ) : (
              <SproutEmpty title="Нет оплат за месяц" minHeight={220} />
            )}
          </SproutCard>
        </Col>
      </Row>

      {/* Table */}
      <SproutCard style={{ marginTop: 16 }} delay={0.3}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>
            Подробно по группам
          </div>
          <Tag style={{ background: SP.surfaceAlt, color: SP.textMid, border: 'none' }}>
            {dayjs(month + '-01').format('MMMM YYYY')}
          </Tag>
        </div>
        {finances.length > 0 ? (
          <Table
            rowKey={(r) => r.group.id}
            dataSource={finances}
            columns={columns}
            pagination={false}
            scroll={{ x: 1100 }}
            size="middle"
            sticky
          />
        ) : (
          <SproutEmpty
            icon={<LayoutGrid size={28} strokeWidth={1.8} />}
            title="Групп пока нет"
            description="Создайте первую группу — Солнышко, Радуга или Звёздочка"
            minHeight={220}
          />
        )}
      </SproutCard>

      {/* Modal */}
      <Modal
        title={editing ? 'Редактировать группу' : 'Новая группа'}
        open={modalOpen}
        onOk={submit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? 'Сохранить' : 'Создать'}
        cancelText="Отмена"
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Название группы"
            name="name"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например, Солнышко" />
          </Form.Item>
          <Form.Item
            label="Возрастная категория"
            name="ageRange"
            rules={[{ required: true, message: 'Укажите возраст' }]}
          >
            <Input placeholder="3–4 года" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Ежемесячная плата за ребёнка" name="monthlyFee">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="сомони" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Фикс. месячные расходы"
                name="fixedMonthlyExpense"
                tooltip="Питание, материалы, доля от аренды"
              >
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="сомони" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Воспитатель" name="teacherId">
            <Select
              allowClear
              placeholder="Выберите воспитателя"
              options={staff
                .filter((s) => s.position === 'Воспитатель')
                .map((s) => ({
                  value: s.id,
                  label: `${s.lastName} ${s.firstName}`,
                }))}
            />
          </Form.Item>
          <Form.Item label="Цвет" name="color">
            <Select
              options={GROUP_COLORS.map((c) => ({
                value: c,
                label: (
                  <Space>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: c,
                      }}
                    />
                    {c}
                  </Space>
                ),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// Suppress unused-vars warning for formatMoney (used in tooltip variants)
void formatMoney
