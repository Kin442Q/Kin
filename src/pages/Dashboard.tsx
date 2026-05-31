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
import { Area } from '@ant-design/charts'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

import {
  SP,
  SproutCard,
  SproutKPI,
  SproutEmpty,
} from '../components/sprout'
import OnboardingChecklist from '../components/OnboardingChecklist'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../hooks/useLabels'
import { http } from '../api'
import { formatMoneyCompact, formatPercent } from '../lib/format'

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

  const navigate = useNavigate()
  const month = dayjs().format('YYYY-MM')
  const L = useLabels()
  const isSchool = L.group === 'класс'

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

  const todayStr = dayjs().format('YYYY-MM-DD')
  const presentToday = attendance.filter(
    (a) => a.date === todayStr && a.status === 'present',
  ).length
  const totalToday = attendance.filter((a) => a.date === todayStr).length
  const attendancePct = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : 89

  // Реальные события из имеющихся данных: дни рождения сегодня + недавно
  // добавленные ученики. Без выдуманных строк — если пусто, покажем пустое состояние.
  const events = useMemo(() => {
    const list: { kind: string; text: string; time: string }[] = []
    const today = dayjs()

    // Дни рождения сегодня
    children.forEach((c) => {
      if (!c.birthDate) return
      const bd = dayjs(c.birthDate)
      if (bd.isValid() && bd.date() === today.date() && bd.month() === today.month()) {
        const age = today.year() - bd.year()
        list.push({
          kind: 'birthday',
          text: `Сегодня день рождения у ${c.firstName} ${c.lastName} (${age})`,
          time: 'сегодня',
        })
      }
    })

    // Недавно добавленные ученики (за 48 часов)
    children
      .filter((c) => c.createdAt && today.diff(dayjs(c.createdAt), 'hour') <= 48)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
      .slice(0, 4)
      .forEach((c) => {
        list.push({
          kind: 'student',
          text: `Добавлен${c.gender === 'female' ? 'а' : ''} ${c.firstName} ${c.lastName}`,
          time: dayjs(c.createdAt).fromNow(),
        })
      })

    return list.slice(0, 6)
  }, [children])

  const hour = new Date().getHours()
  const greeting =
    hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  const userName = user?.fullName?.split(' ')[0] || 'Друг'

  return (
    <div>
      {/* Чек-лист первичной настройки учреждения (для админа, пока не завершён) */}
      <OnboardingChecklist />

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
            {dayjs().format('dddd, D MMMM')} · {isSchool ? 'в школе' : 'в саду'}{' '}
            {dashboard?.activeStudents ?? children.length}{' '}
            {isSchool ? 'учеников' : 'детей'}
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
            label={isSchool ? 'Учеников в школе' : 'Детей в саду'}
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
            <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>
              Финансы за месяц
            </div>
            <div style={{ fontSize: 12, color: SP.muted, marginTop: 2, marginBottom: 16 }}>
              Простыми словами
            </div>

            {global.totalIncome > 0 || global.totalExpenses > 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {([
                  { label: 'Получили (доход)', value: global.totalIncome, color: SP.primary, Icon: Wallet },
                  { label: 'Потратили (расход)', value: global.totalExpenses, color: SP.yellowDeep, Icon: CreditCard },
                  { label: 'Осталось (прибыль)', value: global.netProfit, color: global.netProfit >= 0 ? SP.primaryDeep : SP.danger, Icon: global.netProfit >= 0 ? CheckCircle2 : TrendingDown },
                ]).map((row) => {
                  const max = Math.max(global.totalIncome, global.totalExpenses, 1)
                  const pct = Math.max(4, Math.round((Math.abs(row.value) / max) * 100))
                  return (
                    <div key={row.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SP.textMid }}>
                          {/* Иконки из нового дизайна: цветной бейдж за иконкой */}
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              background: `${row.color}1f`,
                              color: row.color,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <row.Icon size={15} strokeWidth={2} />
                          </span>
                          {row.label}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: row.color }}>
                          {formatMoneyCompact(row.value)}
                        </span>
                      </div>
                      <div style={{ height: 10, borderRadius: 6, background: SP.borderSoft, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          style={{
                            height: '100%',
                            borderRadius: 6,
                            // Стиль диаграмм из нового дизайна: градиентная заливка
                            background: `linear-gradient(90deg, ${row.color}, ${row.color}bb)`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}

                <div
                  style={{
                    marginTop: 'auto',
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: global.netProfit >= 0 ? SP.primaryGhost : 'rgba(239,68,68,0.08)',
                    fontSize: 12.5,
                    color: SP.text,
                    lineHeight: 1.5,
                  }}
                >
                  {global.totalIncome > 0 ? (
                    <>
                      Из каждых <b>100 сомони</b> дохода остаётся{' '}
                      <b style={{ color: global.netProfit >= 0 ? SP.primaryDeep : SP.danger }}>
                        {Math.round(global.margin * 100)} сомони
                      </b>{' '}
                      прибыли.
                    </>
                  ) : (
                    'Дохода в этом месяце пока не было.'
                  )}
                </div>
              </div>
            ) : (
              <SproutEmpty
                title="Данных пока нет"
                description="Здесь появится сводка после первых оплат и расходов"
                minHeight={240}
              />
            )}
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
                  {L.groups} · доходность
                </div>
                <div style={{ fontSize: 12, color: SP.muted, marginTop: 2 }}>
                  {groups.length} {isSchool ? 'классов' : 'групп'}
                </div>
              </div>
              <button
                onClick={() => navigate('/admin/groups')}
                style={{
                  fontSize: 12.5,
                  color: SP.primaryDeep,
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Все {isSchool ? 'классы' : 'группы'} <ArrowRight size={13} />
              </button>
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
                            strokeColor={{
                              from: g.color || SP.primary,
                              to: `${g.color || SP.primary}aa`,
                            }}
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
                title={isSchool ? 'Классы ещё не созданы' : 'Группы ещё не созданы'}
                description={
                  isSchool
                    ? 'Добавьте первый класс — 1А, 5Б или 11А'
                    : 'Добавьте первую группу — Солнышко, Радуга или Звёздочка'
                }
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
              Дни рождения и новые {isSchool ? 'ученики' : 'дети'}
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
