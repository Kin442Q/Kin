import { useEffect, useMemo, useState } from 'react'
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
import { useAuthStore } from '../store/authStore'
import { http } from '../api'
import { formatMoney, formatPercent } from '../lib/format'

interface DashboardApi {
  month: string
  totalIncome: number
  totalExpenses: number
  netProfit: number
  margin: number
  salaries: number
  taxes: number
  isProfitable: boolean
  activeStudents: number
  totalStudents: number
  groups: number
}

interface TrendItem {
  month: string
  income: number
  expenses: number
  profit: number
}

const { Text, Title } = Typography

export default function Dashboard() {
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const staff = useDataStore((s) => s.staff)
  const attendance = useDataStore((s) => s.attendance)
  const notifications = useDataStore((s) => s.notifications)
  const user = useAuthStore((s) => s.user)

  const month = dayjs().format('YYYY-MM')

  // Данные с бекенда (с фильтрацией по садику)
  const [dashboard, setDashboard] = useState<DashboardApi | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])

  useEffect(() => {
    // Глобальный супер-админ не привязан к садику — KPI нечего показывать
    if (!user || !user.kindergartenId) return

    let cancelled = false
    const load = async () => {
      try {
        const [dashRes, trendRes] = await Promise.all([
          http.get<DashboardApi>('/v1/analytics/dashboard', {
            params: { month },
          }),
          http.get<TrendItem[]>('/v1/analytics/trend', {
            params: { monthsBack: 6 },
          }),
        ])
        if (!cancelled) {
          setDashboard(dashRes.data)
          setTrend(trendRes.data)
        }
      } catch (e) {
        console.error('[dashboard] load failed', e)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, month])

  // Краткое значение для удобного доступа в JSX
  const global = {
    totalIncome: dashboard?.totalIncome ?? 0,
    totalExpenses: dashboard?.totalExpenses ?? 0,
    netProfit: dashboard?.netProfit ?? 0,
    margin: dashboard?.margin ?? 0,
  }

  // --- Серия по 6 последним месяцам (демо: текущий — реальный, остальные — лёгкая флуктуация) ---
  // Тренд приходит с бекенда — для каждого месяца две точки (Доход / Расход)
  const trendData = useMemo(() => {
    const arr: { month: string; type: string; value: number }[] = []
    trend.forEach((t) => {
      const label = dayjs(t.month + '-01').format('MMM')
      arr.push({ month: label, type: 'Доход', value: Math.round(t.income) })
      arr.push({ month: label, type: 'Расход', value: Math.round(t.expenses) })
    })
    return arr
  }, [trend])

  // Структура дохода: всё что есть в global.totalIncome — пока показываем одним сегментом
  const incomeBreakdown = useMemo(() => {
    return global.totalIncome > 0
      ? [{ type: 'Оплата родителей', value: global.totalIncome }]
      : []
  }, [global.totalIncome])

  // Категории расходов: salaries / taxes из дашборда, остальное "Прочее"
  const expenseByCategory = useMemo(() => {
    const salaries = dashboard?.salaries ?? 0
    const taxes = dashboard?.taxes ?? 0
    const other = Math.max(
      0,
      global.totalExpenses - salaries - taxes,
    )
    return [
      { type: 'Зарплаты', value: salaries },
      { type: 'Налоги', value: taxes },
      { type: 'Прочее', value: other },
    ].filter((x) => x.value > 0)
  }, [dashboard, global.totalExpenses])

  const presentToday = attendance.filter(
    (a) => a.date === dayjs().format('YYYY-MM-DD') && a.status === 'present',
  ).length
  const totalToday = attendance.filter((a) => a.date === dayjs().format('YYYY-MM-DD')).length

  // Должники: считаем как разницу активных детей и оплативших (приблизительно)
  // Точные данные доступны на странице "Оплата".
  const debtors = Math.max(
    0,
    (dashboard?.activeStudents ?? 0) - 0, // пока упрощённо
  )

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
              <div className="flex items-center justify-between mb-3 lg:w-[700px]">
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
                <Tag color={(dashboard?.isProfitable ?? true) ? 'green' : 'red'}>
                  {(dashboard?.isProfitable ?? true)
                    ? 'Компания прибыльная'
                    : 'Убыток'}
                </Tag>
              </div>
              <List
                dataSource={groups}
                renderItem={(g) => {
                  const groupChildren = children.filter(
                    (c) => c.groupId === g.id,
                  ).length
                  return (
                    <List.Item
                      actions={[
                        <Tag color="blue" key="p">
                          {groupChildren} детей
                        </Tag>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{ background: g.color }}
                            icon={<TeamOutlined />}
                          />
                        }
                        title={
                          <Space>
                            <Text strong>{g.name}</Text>
                            <Text type="secondary">· {g.ageRange}</Text>
                          </Space>
                        }
                        description={
                          <Progress
                            percent={Math.min(
                              100,
                              Math.round((groupChildren / 20) * 100),
                            )}
                            showInfo={false}
                            strokeColor="#6366f1"
                            size="small"
                          />
                        }
                      />
                    </List.Item>
                  )
                }}
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
