import { useEffect, useMemo, useState } from 'react'
import { Row, Col, Tag, Button } from 'antd'
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
  AlertTriangle,
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
  GreetingBanner,
} from '../components/sprout'
import OnboardingChecklist from '../components/OnboardingChecklist'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../hooks/useLabels'
import { useFeature } from '../hooks/useFeature'
import { http } from '../api'
import { formatMoneyCompact, formatPercent } from '../lib/format'
import { classLetterOf, groupByGrade } from '../lib/classes'
import { useChartTheme } from '../theme/chartTheme'
import { useT } from '../i18n'

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
  const t = useT()
  const chartTheme = useChartTheme()
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const staff = useDataStore((s) => s.staff)
  const attendance = useDataStore((s) => s.attendance)
  const user = useAuthStore((s) => s.user)

  const navigate = useNavigate()
  const month = dayjs().format('YYYY-MM')
  const L = useLabels()
  const isSchool = L.group === 'класс'

  // Финансовые блоки показываем только если разделы включены для учреждения.
  const showAnalytics = useFeature('analytics')
  const showPayments = useFeature('payments')
  const showAttendance = useFeature('attendance')
  const showHomeroom = useFeature('homeroom')

  const [dashboard, setDashboard] = useState<DashboardApi | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])

  useEffect(() => {
    // Без раздела «Аналитика» эндпоинты вернут 403 — не ходим за данными.
    if (!user || !user.kindergartenId || !showAnalytics) return

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
  }, [user, month, showAnalytics])

  const global = {
    totalIncome: dashboard?.totalIncome ?? 0,
    totalExpenses: dashboard?.totalExpenses ?? 0,
    netProfit: dashboard?.netProfit ?? 0,
    margin: dashboard?.margin ?? 0,
  }

  const trendData = useMemo(() => {
    const arr: { month: string; type: string; value: number }[] = []
    trend.forEach((item) => {
      const label = dayjs(item.month + '-01').format('MMM')
      arr.push({ month: label, type: t('dash.chart.income'), value: Math.round(item.income) })
      arr.push({ month: label, type: t('dash.chart.expense'), value: Math.round(item.expenses) })
    })
    return arr
  }, [trend, t])

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
          text: t('dash.events.birthday', { name: `${c.firstName} ${c.lastName}`, age }),
          time: t('common.today'),
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
          text: t(c.gender === 'female' ? 'dash.events.addedFemale' : 'dash.events.addedMale', {
            name: `${c.firstName} ${c.lastName}`,
          }),
          time: dayjs(c.createdAt).fromNow(),
        })
      })

    return list.slice(0, 6)
  }, [children, t])

  // Параллели: 1 класс → А, Б, В — компактные плитки вместо длинного списка классов
  const gradeTiles = useMemo(
    () =>
      groupByGrade(groups, (g) => g.name).map((gr) => {
        const counts = gr.items.map((g) => children.filter((c) => c.groupId === g.id).length)
        const total = counts.reduce((a, b) => a + b, 0)
        const capacity = gr.items.length * 20
        return { gr, counts, total, fillPct: Math.min(100, Math.round((total / capacity) * 100)) }
      }),
    [groups, children],
  )

  // Что требует внимания директора (считается из имеющихся данных)
  const attention = useMemo(() => {
    const list: { title: string; text: string; tone: 'rose' | 'yellow' }[] = []
    const noClass = children.filter((c) => !c.groupId).length
    if (noClass > 0)
      list.push({
        title: t('dash.attention.noClass', { n: noClass }),
        text: t('dash.attention.noClassText'),
        tone: 'rose',
      })
    const empty = groups.filter((g) => !children.some((c) => c.groupId === g.id)).length
    if (empty > 0)
      list.push({
        title: t('dash.attention.emptyClass', { n: empty }),
        text: t('dash.attention.emptyClassText'),
        tone: 'yellow',
      })
    if (showHomeroom) {
      const noTeacher = groups.filter((g) => !g.homeroomTeacher).length
      if (noTeacher > 0)
        list.push({
          title: t('dash.attention.noTeacher', { n: noTeacher }),
          text: t('dash.attention.noTeacherText'),
          tone: 'yellow',
        })
    }
    return list
  }, [children, groups, showHomeroom, t])

  const hour = new Date().getHours()
  const greeting =
    hour < 6
      ? t('dash.greet.night')
      : hour < 12
        ? t('dash.greet.morning')
        : hour < 18
          ? t('dash.greet.day')
          : t('dash.greet.evening')
  const userName = user?.fullName?.split(' ')[0] || t('dash.friend')

  return (
    <div>
      {/* Чек-лист первичной настройки учреждения (для админа, пока не завершён) */}
      <OnboardingChecklist />

      {/* Greeting bar */}
      <GreetingBanner
        eyebrow={dayjs().format('dddd, D MMMM')}
        title={`${greeting}, ${userName}!`}
        subtitle={
          <>
            {t('dash.subStudents', { n: dashboard?.activeStudents ?? children.length })}
            {totalToday > 0 ? t('dash.subAttendance', { pct: attendancePct }) : ''}
          </>
        }
        actions={
          <>
            {showAttendance && (
              <Button type="primary" size="large" onClick={() => navigate('/admin/attendance')}>
                {t('dash.markAttendance')}
              </Button>
            )}
            {showPayments && (
              <Button size="large" onClick={() => navigate('/admin/payments')}>
                {t('dash.takePayment')}
              </Button>
            )}
          </>
        }
      />

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        {showAnalytics && (
          <>
        <Col xs={12} sm={12} lg={6}>
          <SproutKPI
            label={t('dash.kpi.income')}
            value={formatMoneyCompact(global.totalIncome)}
            accent="mint"
            trend={12.4}
            hint={t('dash.kpi.incomeHint')}
            icon={<Wallet size={18} strokeWidth={2} />}
            delay={0}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <SproutKPI
            label={t('dash.kpi.expenses')}
            value={formatMoneyCompact(global.totalExpenses)}
            accent="yellow"
            trend={3.1}
            hint={t('dash.kpi.expensesHint')}
            icon={<TrendingDown size={18} strokeWidth={2} />}
            delay={0.05}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <SproutKPI
            label={t('dash.kpi.profit')}
            value={formatMoneyCompact(global.netProfit)}
            accent="blue"
            trend={8.7}
            hint={t('dash.kpi.margin', { pct: formatPercent(global.margin) })}
            icon={<TrendingUp size={18} strokeWidth={2} />}
            delay={0.1}
          />
        </Col>
          </>
        )}
        <Col xs={12} sm={12} lg={showAnalytics ? 6 : 12}>
          <SproutKPI
            label={t('dash.kpi.students')}
            value={String(dashboard?.activeStudents ?? children.length)}
            accent="mint"
            hint={t('dash.kpi.staff', { n: staff.length })}
            icon={<Baby size={18} strokeWidth={2} />}
            delay={0.15}
          />
        </Col>
        {!showAnalytics && (
          <Col xs={12} sm={12} lg={12}>
            <SproutKPI
              label={t('dash.kpi.classes')}
              value={String(groups.length)}
              accent="blue"
              hint={t('dash.kpi.presentToday', { n: presentToday })}
              icon={<CheckCircle2 size={18} strokeWidth={2} />}
              delay={0.2}
            />
          </Col>
        )}
      </Row>

      {/* Charts row (финансы — только при включённой «Аналитике») */}
      {showAnalytics && (
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
                  {t('dash.chart.title')}
                </div>
                <div style={{ fontSize: 12, color: SP.muted, marginTop: 2 }}>
                  {t('dash.chart.sub')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: SP.textMid }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, background: '#0D7A7C', borderRadius: '50%' }} />
                  {t('dash.chart.income')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, background: '#FFB020', borderRadius: '50%' }} />
                  {t('dash.chart.expense')}
                </span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {trendData.length > 0 ? (
                <Area
                  theme={chartTheme}
                  data={trendData}
                  xField="month"
                  yField="value"
                  colorField="type"
                  shapeField="smooth"
                  height={280}
                  // доход и расход — линии с лёгкой заливкой: бирюза и коралл из палитры темы
                  style={{ fillOpacity: 0.16 }}
                  line={{ style: { lineWidth: 3 } }}
                  legend={false}
                />
              ) : (
                <SproutEmpty
                  title={t('dash.empty.title')}
                  description={t('dash.empty.trend')}
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
              {t('dash.fin.title')}
            </div>
            <div style={{ fontSize: 12, color: SP.muted, marginTop: 2, marginBottom: 16 }}>
              {t('dash.fin.sub')}
            </div>

            {global.totalIncome > 0 || global.totalExpenses > 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {([
                  { label: t('dash.fin.got'), value: global.totalIncome, color: SP.primary, Icon: Wallet },
                  { label: t('dash.fin.spent'), value: global.totalExpenses, color: SP.yellowDeep, Icon: CreditCard },
                  { label: t('dash.fin.left'), value: global.netProfit, color: global.netProfit >= 0 ? SP.primaryDeep : SP.danger, Icon: global.netProfit >= 0 ? CheckCircle2 : TrendingDown },
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
                              background: `color-mix(in srgb, ${row.color} 12%, transparent)`,
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
                            background: `linear-gradient(90deg, ${row.color}, color-mix(in srgb, ${row.color} 73%, transparent))`,
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
                    background: global.netProfit >= 0 ? SP.primaryGhost : 'var(--sp-rose-soft)',
                    fontSize: 12.5,
                    color: SP.text,
                    lineHeight: 1.5,
                  }}
                >
                  {global.totalIncome > 0 ? (
                    <>
                      {t.rich('dash.fin.per100', {
                        a: <b>{t('dash.fin.per100a')}</b>,
                        b: (
                          <b style={{ color: global.netProfit >= 0 ? SP.primaryDeep : SP.danger }}>
                            {t('dash.fin.per100b', { x: Math.round(global.margin * 100) })}
                          </b>
                        ),
                      })}
                    </>
                  ) : (
                    t('dash.fin.noIncome')
                  )}
                </div>
              </div>
            ) : (
              <SproutEmpty
                title={t('dash.empty.title')}
                description={t('dash.empty.finance')}
                minHeight={240}
              />
            )}
          </SproutCard>
        </Col>
      </Row>
      )}

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
                  {t('dash.classes.title')}{showAnalytics ? t('dash.classes.profitSuffix') : ''}
                </div>
                <div style={{ fontSize: 12, color: SP.muted, marginTop: 2 }}>
                  {t('dash.classes.count', { n: groups.length })}{' '}
                  {t('dash.classes.inParallels', { n: gradeTiles.length })}
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
                {t('dash.classes.all')} <ArrowRight size={13} />
              </button>
            </div>
            {groups.length > 0 ? (
              <div className="sp-parallels">
                {gradeTiles.map(({ gr, counts, total, fillPct }, idx) => (
                  <motion.div
                    key={String(gr.key)}
                    className="sp-parallel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.04, duration: 0.3 }}
                  >
                    <div className="sp-parallel-top">
                      <span className="sp-grade-badge">{gr.grade ?? '•'}</span>
                      <div className="sp-parallel-title">
                        <b>{gr.label}</b>
                        <span>{t('dash.classes.count', { n: gr.items.length })}</span>
                      </div>
                      <span className="sp-parallel-total sp-num">{total}</span>
                    </div>
                    <div className="sp-parallel-letters">
                      {gr.items.map((g, i) => (
                        <button
                          key={g.id}
                          type="button"
                          className="sp-parallel-chip"
                          title={`${g.name}: ${counts[i]}`}
                          onClick={() => navigate(`/admin/groups/${g.id}`)}
                        >
                          <i style={{ background: g.color }} />
                          {classLetterOf(g.name).slice(0, 3)}
                          <small>{counts[i]}</small>
                        </button>
                      ))}
                    </div>
                    <div className="sp-parallel-bar" aria-hidden="true">
                      <span style={{ width: `${fillPct}%` }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <SproutEmpty
                title={t('dash.classes.emptyTitle')}
                description={t('dash.classes.emptyDesc')}
                minHeight={200}
              />
            )}
          </SproutCard>
        </Col>

        <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Требует внимания */}
          <SproutCard padding={18} delay={0.3}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 700, color: SP.text }}>{t('dash.attention.title')}</div>
              {attention.length > 0 && (
                <span
                  className="sp-chip"
                  style={{ background: SP.roseSoft, color: SP.roseDeep, padding: '2px 9px' }}
                >
                  {attention.length}
                </span>
              )}
            </div>
            {attention.length === 0 ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: SP.textMid, fontSize: 13 }}>
                <CheckCircle2 size={20} color={SP.primary} strokeWidth={1.8} />
                {t('dash.attention.ok')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attention.map((a) => (
                  <div
                    key={a.title}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: 12,
                      borderRadius: 14,
                      background: a.tone === 'rose' ? SP.roseSoft : SP.yellowSoft,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        flex: 'none',
                        borderRadius: 10,
                        background: SP.solid,
                        color: a.tone === 'rose' ? SP.roseDeep : SP.yellowDeep,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <AlertTriangle size={16} strokeWidth={2} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: SP.text }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: SP.textMid, lineHeight: 1.45, marginTop: 2 }}>{a.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SproutCard>

          {/* Сегодня */}
          <SproutCard padding={18} delay={0.35}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: SP.text, marginBottom: 12 }}>
              {t('dash.today.title')}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: showPayments ? `1px solid ${SP.borderSoft}` : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: SP.muted }}>{t('dash.today.attendance')}</div>
                <div
                  className="sp-num"
                  style={{ fontSize: 22, fontWeight: 700, color: SP.primaryDeep }}
                >
                  {attendancePct}%
                </div>
              </div>
              <CheckCircle2 size={28} color={SP.primary} strokeWidth={1.8} />
            </div>
            {showPayments && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: SP.muted }}>{t('dash.today.debtors')}</div>
                  <div
                    className="sp-num"
                    style={{ fontSize: 22, fontWeight: 700, color: SP.danger }}
                  >
                    —
                  </div>
                </div>
                <CreditCard size={28} color={SP.danger} strokeWidth={1.8} />
              </div>
            )}
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
              <Bell size={14} /> {t('dash.events.title')}
            </div>
            <div style={{ fontSize: 12, color: SP.muted, marginBottom: 12 }}>
              {t('dash.events.sub')}
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
                title={t('dash.events.empty')}
                minHeight={120}
              />
            )}
          </SproutCard>
        </Col>
      </Row>
    </div>
  )
}
