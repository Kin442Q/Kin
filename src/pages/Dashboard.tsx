import { useMemo } from 'react'
import { Row, Col, Card, Typography, List, Tag, Progress, Space, Avatar } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  WalletOutlined,
  RiseOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { Area, Pie, Column } from '@ant-design/charts'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import PageHeader from '../components/PageHeader'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { calcGroupFinances, calcGlobalFinance } from '../lib/finance'
import { formatMoney, formatPercent } from '../lib/format'

const { Text, Title } = Typography

export default function Dashboard() {
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const staff = useDataStore((s) => s.staff)
  const payments = useDataStore((s) => s.payments)
  const expenses = useDataStore((s) => s.expenses)
  const attendance = useDataStore((s) => s.attendance)
  const extraIncome = useDataStore((s) => s.extraIncome)
  const notifications = useDataStore((s) => s.notifications)

  const month = dayjs().format('YYYY-MM')

  const groupFinances = useMemo(
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
  const global = useMemo(
    () => calcGlobalFinance(groupFinances, expenses, month),
    [groupFinances, expenses, month],
  )

  // --- Серия по 6 последним месяцам (демо: текущий — реальный, остальные — лёгкая флуктуация) ---
  const trendData = useMemo(() => {
    const base = global.totalIncome || 30000
    const baseExp = global.totalExpenses || 25000
    const arr: { month: string; type: string; value: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = dayjs().subtract(i, 'month').format('MMM')
      const factor = 0.7 + ((6 - i) / 6) * 0.6 // постепенный рост
      arr.push({ month: m, type: 'Доход', value: Math.round(base * factor) })
      arr.push({ month: m, type: 'Расход', value: Math.round(baseExp * (0.85 + (5 - i) * 0.04)) })
    }
    return arr
  }, [global.totalIncome, global.totalExpenses])

  const incomeBreakdown = useMemo(() => {
    const fromFees = payments
      .filter((p) => p.paid && p.month === month)
      .reduce((s, p) => s + p.amount, 0)
    const extra = extraIncome
      .filter((e) => e.month === month)
      .reduce((s, e) => s + e.amount, 0)
    return [
      { type: 'Оплата родителей', value: fromFees },
      { type: 'Доп. услуги', value: extra },
    ].filter((x) => x.value > 0)
  }, [payments, extraIncome, month])

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    expenses
      .filter((e) => e.month === month)
      .forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount))
    return Array.from(map.entries()).map(([type, value]) => ({ type, value }))
  }, [expenses, month])

  const presentToday = attendance.filter(
    (a) => a.date === dayjs().format('YYYY-MM-DD') && a.status === 'present',
  ).length
  const totalToday = attendance.filter((a) => a.date === dayjs().format('YYYY-MM-DD')).length

  const debtors = payments.filter((p) => p.month === month && !p.paid).length

  return (
    <div>
      <PageHeader
        title="Главная"
        icon={<DashboardOutlined />}
        description={`Сводка за ${dayjs().format('MMMM YYYY')} · по всем группам`}
      />

      {/* KPI */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Доход за месяц"
            value={global.totalIncome}
            format="money"
            variant="success"
            icon={<WalletOutlined />}
            trend={12.4}
            delay={0.0}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Расходы за месяц"
            value={global.totalExpenses}
            format="money"
            variant="warning"
            icon={<RiseOutlined />}
            trend={3.1}
            delay={0.05}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Чистая прибыль"
            value={global.netProfit}
            format="money"
            variant={global.netProfit >= 0 ? 'primary' : 'danger'}
            icon={<RiseOutlined />}
            hint={
              <span>
                Маржа{' '}
                <Text strong style={{ color: global.netProfit >= 0 ? '#10b981' : '#f43f5e' }}>
                  {formatPercent(global.margin)}
                </Text>
              </span>
            }
            delay={0.1}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Детей в саду"
            value={children.length}
            variant="primary"
            icon={<UserOutlined />}
            hint={`Сотрудников: ${staff.length}`}
            delay={0.15}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={16}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="glass" bordered={false}>
              <div className="flex items-center justify-between mb-3">
                <Title level={5} style={{ margin: 0 }}>
                  Доход и расход (6 месяцев)
                </Title>
                <Tag color="purple">тренд</Tag>
              </div>
              <Area
                data={trendData}
                xField="month"
                yField="value"
                seriesField="type"
                //@ts-ignore
                smooth
                height={280}
                animation={{ appear: { animation: 'wave-in', duration: 1100 } }}
                color={['#10b981', '#f59e0b']}
                areaStyle={{ fillOpacity: 0.35 }}
                legend={{ position: 'top-right' }}
              />
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="glass" bordered={false}>
              <Title level={5} style={{ margin: 0, marginBottom: 12 }}>
                Структура дохода
              </Title>
              {incomeBreakdown.length > 0 ? (
                <Pie
                  data={incomeBreakdown}
                  angleField="value"
                  colorField="type"
                  radius={0.9}
                  innerRadius={0.6}
                  height={260}
                  legend={{ position: 'bottom' }}
                  color={['#6366f1', '#ec4899']}
                  statistic={{
                    title: { content: 'Итого', style: { fontSize: '12px' } },
                    content: { content: formatMoney(global.totalIncome), style: { fontSize: '16px' } },
                  }}
                />
              ) : (
                <Text type="secondary">Нет данных за месяц</Text>
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
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="glass" bordered={false}>
              <div className="flex items-center justify-between mb-3">
                <Title level={5} style={{ margin: 0 }}>
                  Расходы по категориям
                </Title>
                <Tag color="volcano">текущий месяц</Tag>
              </div>
              <Column
                data={expenseByCategory}
                xField="type"
                yField="value"
                height={280}
                color="#a855f7"
                columnStyle={{ radius: [8, 8, 0, 0] }}
                xAxis={{ label: { autoRotate: true } }}
                animation={{ appear: { animation: 'fade-in', duration: 800 } }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <Card className="glass" bordered={false}>
              <div className="flex items-center justify-between mb-3">
                <Title level={5} style={{ margin: 0 }}>
                  <AppstoreOutlined /> Группы
                </Title>
                <Tag color={global.isProfitable ? 'green' : 'red'}>
                  {global.isProfitable ? 'Компания прибыльная' : 'Убыток'}
                </Tag>
              </div>
              <List
                dataSource={groupFinances}
                renderItem={(g) => (
                  <List.Item
                    actions={[
                      <Tag color={g.profit >= 0 ? 'green' : 'red'} key="p">
                        {g.profit >= 0 ? '+' : ''}
                        {formatMoney(g.profit)}
                      </Tag>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar style={{ background: g.group.color }} icon={<TeamOutlined />} />
                      }
                      title={
                        <Space>
                          <Text strong>{g.group.name}</Text>
                          <Text type="secondary">· {g.childrenCount} детей</Text>
                        </Space>
                      }
                      description={
                        <Progress
                          percent={Math.max(0, Math.min(100, (g.margin || 0) * 100 + 50))}
                          showInfo={false}
                          strokeColor={g.profit >= 0 ? '#10b981' : '#f43f5e'}
                          size="small"
                        />
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={8}>
          <StatCard
            title="Посещаемость сегодня"
            value={totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : 0}
            suffix="%"
            prefix={<CheckCircleOutlined />}
            variant="success"
            hint={`${presentToday} из ${totalToday}`}
            delay={0.4}
          />
        </Col>
        <Col xs={24} lg={8}>
          <StatCard
            title="Должники по оплате"
            value={debtors}
            prefix={<WalletOutlined />}
            variant="danger"
            hint="за текущий месяц"
            delay={0.45}
          />
        </Col>
        <Col xs={24} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card className="glass" bordered={false} title={<><BellOutlined /> Последние события</>}>
              <List
                size="small"
                dataSource={notifications.slice(0, 4)}
                locale={{ emptyText: 'Тихо. Уведомлений нет.' }}
                renderItem={(n) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<span style={{ fontSize: 13 }}>{n.title}</span>}
                      description={<span style={{ fontSize: 12 }}>{n.description}</span>}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  )
}
