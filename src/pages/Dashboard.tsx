import { useEffect, useMemo, useState } from 'react'
import { Row, Col, Progress, Tag } from 'antd'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Baby,
  CheckCircle2,
  Cake,
  Sparkles,
  CreditCard,
  ArrowRight,
  Bell,
  Zap,
} from 'lucide-react'
import { Area, Pie } from '@ant-design/charts'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import {
  SP,
  SproutCard,
  SproutKPI,
  SproutEmpty,
} from '../components/sprout'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { http } from '../api'
import { formatMoney, formatMoneyCompact, formatPercent } from '../lib/format'

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

export default function Dashboard() {
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const staff = useDataStore((s) => s.staff)
  const attendance = useDataStore((s) => s.attendance)
  const user = useAuthStore((s) => s.user)

  const month = dayjs().format('YYYY-MM')

  const [dashboard, setDashboard] = useState<DashboardApi | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])

  useEffect(() => {
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

  const global = {
    totalIncome: dashboard?.totalIncome ?? 0,
    totalExpenses: dashboard?.totalExpenses ?? 0,
    netProfit: dashboard?.netProfit ?? 0,
    margin: dashboard?.margin ?? 0,
  }

  const trendData = useMemo(() => {
    const arr: { month: string; type: string; value: number }[] = []
    trend.forEach((t) => {
      const label = dayjs(t.month + '-01').format('MMM')
      arr.push({ month: label, type: 'Доход', value: Math.round(t.income) })
      arr.push({ month: label, type: 'Расход', value: Math.round(t.expenses) })
    })
    return arr
  }, [trend])

  const incomeBreakdown = useMemo(() => {
    return global.totalIncome > 0
      ? [{ type: 'Оплата родителей', value: global.totalIncome }]
      : []
  }, [global.totalIncome])

  const todayStr = dayjs().format('YYYY-MM-DD')
  const presentToday = attendance.filter(
    (a) => a.date === todayStr && a.status === 'present',
  ).length
  const totalToday = attendance.filter((a) => a.date === todayStr).length
  const attendancePct = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : 89

  // Заглушка для событий (TODO: подключить реальные данные)
  const events = [
    { kind: 'payment', text: 'Поступила оплата от Айши Ахмедовой', time: '5 мин назад' },
    { kind: 'attendance', text: 'Группа «Солнышко» полностью отмечена', time: '1 час назад' },
    { kind: 'birthday', text: 'Сегодня день рождения у Малики', time: '3 часа назад' },
  ]

  const hour = new Date().getHours()
  const greeting =
    hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  const userName = user?.fullName?.split(' ')[0] || 'Друг'

  return (
    <div>
      {/* Greeting bar */}
      <SproutCard
        accent="mint-yellow"
        padding={18}
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div style={{ fontSize: 36, flexShrink: 0 }}>🌿</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: SP.text }}>
            {greeting}, {userName}!
          </div>
          <div
            style={{
              fontSize: 13,
              color: SP.textMid,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {dayjs().format('dddd, D MMMM')} · в саду {dashboard?.activeStudents ?? children.length} детей
            {totalToday > 0 ? ` · ${attendancePct}% посещаемость` : ''}
          </div>
        </div>
      </SproutCard>

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} lg={6}>
          <SproutKPI
            label="Доход за месяц"
            value={formatMoneyCompact(global.totalIncome)}
            accent="mint"
            trend={12.4}
            hint="к плану"
            icon={<Wallet size={18} strokeWidth={2} />}
            delay={0}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <SproutKPI
            label="Расходы за месяц"
            value={formatMoneyCompact(global.totalExpenses)}
            accent="yellow"
            trend={3.1}
            hint="бюджет"
            icon={<TrendingDown size={18} strokeWidth={2} />}
            delay={0.05}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <SproutKPI
            label="Чистая прибыль"
            value={formatMoneyCompact(global.netProfit)}
            accent="blue"
            trend={8.7}
            hint={`маржа ${formatPercent(global.margin)}`}
            icon={<TrendingUp size={18} strokeWidth={2} />}
            delay={0.1}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <SproutKPI
            label="Детей в саду"
            value={String(dashboard?.activeStudents ?? children.length)}
            accent="mint"
            hint={`Сотрудников: ${staff.length}`}
            icon={<Baby size={18} strokeWidth={2} />}
            delay={0.15}
          />
        </Col>
      </Row>

      {/* Charts row */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={16} style={{ display: 'flex' }}>
          <SproutCard
            style={{ width: '100%', height: 360, display: 'flex', flexDirection: 'column' }}
            delay={0.2}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>
                  Доход и расход
                </div>
                <div style={{ fontSize: 12, color: SP.muted, marginTop: 2 }}>
                  Последние 6 месяцев
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: SP.textMid }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 2, background: SP.primary, borderRadius: 2 }} />
                  Доход
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 2, background: SP.yellowDeep, borderRadius: 2 }} />
                  Расход
                </span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {trendData.length > 0 ? (
                <Area
                  data={trendData}
                  xField="month"
                  yField="value"
                  seriesField="type"
                  //@ts-ignore
                  smooth
                  height={280}
                  color={[SP.primary, SP.yellowDeep]}
                  areaStyle={{ fillOpacity: 0.3 }}
                  legend={false}
                  animation={{ appear: { animation: 'wave-in', duration: 1100 } }}
                />
              ) : (
                <SproutEmpty
                  title="Данных пока нет"
                  description="Здесь появится тренд после первого месяца работы"
                  minHeight={240}
                />
              )}
            </div>
          </SproutCard>
        </Col>

        <Col xs={24} lg={8} style={{ display: 'flex' }}>
          <SproutCard
            style={{ width: '100%', height: 360, display: 'flex', flexDirection: 'column' }}
            delay={0.25}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: SP.text, marginBottom: 12 }}>
              Структура дохода
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {incomeBreakdown.length > 0 ? (
                <Pie
                  data={incomeBreakdown}
                  angleField="value"
                  colorField="type"
                  radius={0.9}
                  innerRadius={0.62}
                  height={280}
                  legend={{ position: 'bottom' }}
                  color={[SP.primary, SP.blueDeep, SP.yellowDeep]}
                  statistic={{
                    title: {
                      content: 'Доход',
                      style: { fontSize: '12px', color: SP.muted },
                    },
                    content: {
                      content: formatMoney(global.totalIncome),
                      style: {
                        fontSize: '15px',
                        fontWeight: '700',
                        color: SP.text,
                      },
                    },
                  }}
                />
              ) : (
                <SproutEmpty
                  title="Дохода ещё не было"
                  description="Здесь появится разбивка после первых оплат"
                  minHeight={240}
                />
              )}
            </div>
          </SproutCard>
        </Col>
      </Row>

      {/* Groups + sidebar widgets */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} lg={16} style={{ display: 'flex' }}>
          <SproutCard style={{ width: '100%' }} delay={0.3}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>
                  Группы · доходность
                </div>
                <div style={{ fontSize: 12, color: SP.muted, marginTop: 2 }}>
                  {groups.length} групп
                </div>
              </div>
              <a
                href="#/admin/groups"
                style={{
                  fontSize: 12.5,
                  color: SP.primaryDeep,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Все группы <ArrowRight size={13} />
              </a>
            </div>
            {groups.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groups.map((g, idx) => {
                  const groupChildren = children.filter((c) => c.groupId === g.id).length
                  const fillPct = Math.min(100, Math.round((groupChildren / 20) * 100))
                  return (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + idx * 0.05, duration: 0.3 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '10px 12px',
                        borderRadius: 12,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = SP.primaryGhost
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          width: 36,
                          height: 36,
                          borderRadius: 11,
                          background: g.color ? `${g.color}22` : SP.primarySoft,
                          color: g.color || SP.primaryDeep,
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {g.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: SP.text }}>
                          {g.name}{' '}
                          <span style={{ color: SP.muted, fontWeight: 400, fontSize: 12 }}>
                            · {g.ageRange}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 4,
                          }}
                        >
                          <Progress
                            percent={fillPct}
                            showInfo={false}
                            strokeColor={g.color || SP.primary}
                            size="small"
                            style={{ flex: 1, margin: 0 }}
                          />
                          <span
                            className="sp-num"
                            style={{ fontSize: 11, color: SP.muted, minWidth: 36 }}
                          >
                            {groupChildren}/20
                          </span>
                        </div>
                      </div>
                      <Tag
                        style={{
                          background: SP.primaryGhost,
                          color: SP.primaryDeep,
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {formatMoneyCompact(g.monthlyFee * groupChildren)}
                      </Tag>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <SproutEmpty
                title="Группы ещё не созданы"
                description="Добавьте первую группу — Солнышко, Радуга или Звёздочка"
                minHeight={200}
              />
            )}
          </SproutCard>
        </Col>

        <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Сегодня */}
          <SproutCard padding={18} delay={0.35}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: SP.text, marginBottom: 12 }}>
              Сегодня
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: `1px solid ${SP.borderSoft}`,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: SP.muted }}>Посещаемость</div>
                <div
                  className="sp-num"
                  style={{ fontSize: 22, fontWeight: 700, color: SP.primaryDeep }}
                >
                  {attendancePct}%
                </div>
              </div>
              <CheckCircle2 size={28} color={SP.primary} strokeWidth={1.8} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: SP.muted }}>Должники</div>
                <div
                  className="sp-num"
                  style={{ fontSize: 22, fontWeight: 700, color: SP.danger }}
                >
                  —
                </div>
              </div>
              <CreditCard size={28} color={SP.danger} strokeWidth={1.8} />
            </div>
          </SproutCard>

          {/* События */}
          <SproutCard padding={18} delay={0.4}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13.5,
                fontWeight: 700,
                color: SP.text,
                marginBottom: 4,
              }}
            >
              <Bell size={14} /> События
            </div>
            <div style={{ fontSize: 12, color: SP.muted, marginBottom: 12 }}>
              За последние 24 часа
            </div>
            {events.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {events.map((e, i) => {
                  const Icon =
                    e.kind === 'payment' ? CreditCard :
                    e.kind === 'attendance' ? CheckCircle2 :
                    e.kind === 'birthday' ? Cake : Sparkles
                  return (
                    <div
                      key={i}
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 9,
                          background: SP.primaryGhost,
                          color: SP.primaryDeep,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        <Icon size={14} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: SP.text, lineHeight: 1.4 }}>
                          {e.text}
                        </div>
                        <div style={{ fontSize: 10.5, color: SP.muted, marginTop: 2 }}>
                          {e.time}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <SproutEmpty
                icon={<Zap size={24} strokeWidth={1.6} />}
                title="Тихо. Событий нет."
                minHeight={120}
              />
            )}
          </SproutCard>
        </Col>
      </Row>
    </div>
  )
}
