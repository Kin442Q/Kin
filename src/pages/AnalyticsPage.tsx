import { useMemo, useState } from 'react'
import {
  Alert,
  Card,
  Col,
  Row,
  Space,
  Tag,
  Typography,
  Statistic,
  Progress,
  Table,
  DatePicker,
} from 'antd'
import {
  RiseOutlined,
  WalletOutlined,
  AlertOutlined,
  CrownOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Area, Column, Pie, Line } from '@ant-design/charts'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import PageHeader from '../components/PageHeader'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { calcGlobalFinance, calcGroupFinances } from '../lib/finance'
import { formatMoney, formatMoneyCompact, formatPercent } from '../lib/format'

const { Text, Title } = Typography

export default function AnalyticsPage() {
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const payments = useDataStore((s) => s.payments)
  const expenses = useDataStore((s) => s.expenses)
  const extraIncome = useDataStore((s) => s.extraIncome)
  const attendance = useDataStore((s) => s.attendance)

  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))

  // Текущий месяц
  const groupFin = useMemo(
    () => calcGroupFinances({ groups, children, payments, expenses, extraIncome, attendance, month }),
    [groups, children, payments, expenses, extraIncome, attendance, month],
  )
  const global = useMemo(
    () => calcGlobalFinance(groupFin, expenses, month),
    [groupFin, expenses, month],
  )

  // 12-месячный тренд
  const yearTrend = useMemo(() => {
    const arr: { month: string; income: number; expenses: number; profit: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const m = dayjs().subtract(i, 'month').format('YYYY-MM')
      const gf = calcGroupFinances({
        groups,
        children,
        payments,
        expenses,
        extraIncome,
        attendance,
        month: m,
      })
      const g = calcGlobalFinance(gf, expenses, m)
      arr.push({
        month: dayjs(m + '-01').format('MMM YY'),
        income: g.totalIncome,
        expenses: g.totalExpenses,
        profit: g.netProfit,
      })
    }
    return arr
  }, [groups, children, payments, expenses, extraIncome, attendance])

  // Серии для area-чарта дохода/расхода
  const trendSeries = yearTrend.flatMap((p) => [
    { month: p.month, type: 'Доход', value: p.income },
    { month: p.month, type: 'Расход', value: p.expenses },
  ])

  // Тренд прибыли — отдельная линия (определяем рост/спад)
  const profitTrend = yearTrend.map((p) => ({ month: p.month, value: p.profit }))
  const lastTwo = yearTrend.slice(-2)
  const profitGrowing =
    lastTwo.length === 2 ? lastTwo[1].profit >= lastTwo[0].profit : true
  const growthPct =
    lastTwo.length === 2 && lastTwo[0].profit !== 0
      ? ((lastTwo[1].profit - lastTwo[0].profit) / Math.abs(lastTwo[0].profit)) * 100
      : 0

  // ROI = чистая прибыль / расходы * 100%
  const roi = global.totalExpenses > 0 ? global.netProfit / global.totalExpenses : 0

  // Cash flow (приток - отток) по 6 месяцам
  const cashFlow = yearTrend.slice(-6).map((p) => ({
    month: p.month,
    type: 'Приток',
    value: p.income,
  })).concat(
    yearTrend.slice(-6).map((p) => ({
      month: p.month,
      type: 'Отток',
      value: -p.expenses,
    })),
  )

  // Доля категорий в расходах
  const expenseShare = (() => {
    const map = new Map<string, number>()
    expenses
      .filter((e) => e.month === month)
      .forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount))
    return Array.from(map.entries()).map(([type, value]) => ({ type, value }))
  })()

  // Самые прибыльные / убыточные группы
  const sortedByProfit = [...groupFin].sort((a, b) => b.profit - a.profit)

  return (
    <div>
      <PageHeader
        title="Аналитика"
        icon={<RiseOutlined />}
        description="Глобальная финансовая картина по всему саду"
        actions={
          <DatePicker
            picker="month"
            value={dayjs(month + '-01')}
            onChange={(d) => d && setMonth(d.format('YYYY-MM'))}
            allowClear={false}
          />
        }
      />

      {/* Главная сводка с авто-выводом */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Alert
          type={global.isProfitable ? 'success' : 'error'}
          showIcon
          icon={global.isProfitable ? <CrownOutlined /> : <AlertOutlined />}
          message={
            <Space>
              {global.isProfitable ? (
                <Text strong>Компания прибыльная</Text>
              ) : (
                <Text strong>Компания убыточная</Text>
              )}
              <Tag color={profitGrowing ? 'green' : 'red'}>
                {profitGrowing ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{' '}
                Прибыль {profitGrowing ? 'растёт' : 'падает'} (
                {isFinite(growthPct) ? Math.max(-999, Math.min(999, growthPct)).toFixed(1) : '0.0'}% за месяц)
              </Tag>
            </Space>
          }
          description={
            <span>
              Доход: <Text strong>{formatMoneyCompact(global.totalIncome)}</Text> · Расходы:{' '}
              <Text strong>{formatMoneyCompact(global.totalExpenses)}</Text> · Чистая прибыль:{' '}
              <Text strong style={{ color: global.netProfit >= 0 ? '#10b981' : '#f43f5e' }}>
                {global.netProfit >= 0 ? '+' : ''}
                {formatMoneyCompact(global.netProfit)}
              </Text>{' '}
              · Маржа: <Text strong>{formatPercent(global.margin)}</Text> · ROI:{' '}
              <Text strong>{formatPercent(roi)}</Text>
            </span>
          }
          style={{ marginBottom: 16 }}
        />
      </motion.div>

      {/* KPI */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard
            title="Доход всех групп"
            value={global.totalIncome}
            format="money"
            variant="success"
            icon={<WalletOutlined />}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Расходы всего"
            value={global.totalExpenses}
            format="money"
            variant="warning"
            icon={<RiseOutlined />}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Зарплаты"
            value={global.salaries}
            format="money"
            variant="primary"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Налоги"
            value={global.taxes}
            format="money"
            variant="danger"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={16}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>Динамика дохода и расхода (12 месяцев)</Title>
              <Area
                data={trendSeries}
                xField="month"
                yField="value"
                seriesField="type"
                //@ts-ignore
                smooth
                height={300}
                color={['#10b981', '#f59e0b']}
                areaStyle={{ fillOpacity: 0.35 }}
                legend={{ position: 'top-right' }}
                animation={{ appear: { animation: 'wave-in', duration: 1100 } }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>Profit / Loss</Title>
              <Line
                data={profitTrend}
                xField="month"
                yField="value"
                smooth
                height={300}
                color={profitGrowing ? '#10b981' : '#f43f5e'}
                point={{ size: 4 }}
                animation={{ appear: { animation: 'path-in', duration: 1100 } }}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>Cash flow (6 мес.)</Title>
              <Column
                data={cashFlow}
                xField="month"
                yField="value"
                seriesField="type"
                isGroup
                height={280}
                color={['#10b981', '#f43f5e']}
                columnStyle={{ radius: [8, 8, 0, 0] }}
                legend={{ position: 'top-right' }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>Структура расходов</Title>
              {expenseShare.length > 0 ? (
                <Pie
                  data={expenseShare}
                  angleField="value"
                  colorField="type"
                  radius={0.9}
                  innerRadius={0.55}
                  height={280}
                  legend={{ position: 'bottom' }}
                />
              ) : (
                <Text type="secondary">Нет расходов в выбранный месяц</Text>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>
                <ThunderboltOutlined /> Финансовая эффективность
              </Title>
              <div className="mt-3">
                <Text type="secondary">Маржа прибыли</Text>
                <Progress
                  percent={Math.max(0, Math.min(100, global.margin * 100))}
                  strokeColor={{ from: '#6366f1', to: '#10b981' }}
                  format={() => formatPercent(global.margin)}
                />
                <Text type="secondary">ROI</Text>
                <Progress
                  percent={Math.max(0, Math.min(100, roi * 100))}
                  strokeColor={{ from: '#a855f7', to: '#ec4899' }}
                  format={() => formatPercent(roi)}
                />
                <Text type="secondary">Привлечение детей (заполнено мест условно: 60 чел.)</Text>
                <Progress
                  percent={Math.max(0, Math.min(100, (children.length / 60) * 100))}
                  strokeColor={{ from: '#06b6d4', to: '#10b981' }}
                  format={() => `${children.length} / 60`}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Statistic
                  title="Лучшая группа"
                  value={global.bestGroup?.group.name || '—'}
                  valueStyle={{ color: '#10b981', fontWeight: 700, fontSize: 18 }}
                />
                <Statistic
                  title="Худшая группа"
                  value={global.worstGroup?.group.name || '—'}
                  valueStyle={{ color: '#f43f5e', fontWeight: 700, fontSize: 18 }}
                />
              </div>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5}>Группы: рейтинг прибыли</Title>
              <Table
                rowKey={(r) => r.group.id}
                dataSource={sortedByProfit}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '#',
                    key: 'rk',
                    width: 40,
                    render: (_, __, idx) => (
                      <Tag color={idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'default'}>{idx + 1}</Tag>
                    ),
                  },
                  {
                    title: 'Группа',
                    key: 'name',
                    render: (_, r) => <Text strong>{r.group.name}</Text>,
                  },
                  {
                    title: 'Доход',
                    dataIndex: 'income',
                    render: (v: number) => formatMoney(v),
                  },
                  {
                    title: 'Прибыль',
                    dataIndex: 'profit',
                    render: (v: number) => (
                      <Tag color={v >= 0 ? 'green' : 'red'}>
                        {v >= 0 ? '+' : ''}
                        {formatMoney(v)}
                      </Tag>
                    ),
                  },
                ]}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  )
}
