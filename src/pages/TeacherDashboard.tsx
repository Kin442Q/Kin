import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Modal,
  Row,
  Col,
  Tag,
  Progress,
  App as AntdApp,
  Spin,
  Table,
  Tooltip,
} from 'antd'
import {
  Clock,
  LogIn,
  LogOut,
  Camera,
  Wallet,
  Calendar as CalendarIcon,
  TrendingUp,
} from 'lucide-react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import {
  SP,
  SproutCard,
  SproutKPI,
  SproutEmpty,
  SproutPageHeader,
} from '../components/sprout'
import FaceCapture from '../components/face/FaceCapture'
import { useAuthStore } from '../store/authStore'
import { timeService, type TimeMonthSummary } from '../api'
import { formatMoneyCompact, formatPercent } from '../lib/format'

type Mode = 'register' | 'verify' | null

export default function TeacherDashboard() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<TimeMonthSummary | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [activeCheckIn, setActiveCheckIn] = useState<string | null>(null)
  const [hasFace, setHasFace] = useState(false)
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null)
  const [now, setNow] = useState(new Date())

  const [faceModal, setFaceModal] = useState<Mode>(null)
  /** 'check-in' | 'check-out' — что нужно сделать после успешной верификации */
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null)

  const month = dayjs().format('YYYY-MM')

  // Загрузка
  const reload = async () => {
    try {
      setLoading(true)
      const [statusRes, monthRes, faceRes] = await Promise.all([
        timeService.status(),
        timeService.myMonth(month),
        timeService.getFace(),
      ])
      setIsWorking(statusRes.isWorking)
      setActiveCheckIn(statusRes.activeEntry?.checkIn || null)
      setSummary(monthRes)
      setHasFace(faceRes.hasFace)
      setFaceDescriptor(
        Array.isArray(faceRes.descriptor) ? faceRes.descriptor : null,
      )
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Тикающий таймер для активной смены
  useEffect(() => {
    if (!isWorking) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [isWorking])

  const elapsedToday = useMemo(() => {
    if (!isWorking || !activeCheckIn) return null
    const start = new Date(activeCheckIn).getTime()
    const sec = Math.max(0, Math.floor((now.getTime() - start) / 1000))
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return { h, m, s, total: sec }
  }, [isWorking, activeCheckIn, now])

  // ─── Действия ─────────────────────────────────────────────────────

  const handleClick = (action: 'in' | 'out') => {
    if (!hasFace) {
      Modal.confirm({
        title: 'Сначала зарегистрируйте лицо',
        content:
          'Для отметки Face ID нужно один раз показать камере своё лицо. Зарегистрировать сейчас?',
        okText: 'Зарегистрировать',
        cancelText: 'Позже',
        onOk: () => setFaceModal('register'),
      })
      return
    }
    setPendingAction(action)
    setFaceModal('verify')
  }

  const onFaceRegistered = async (descriptor: number[]) => {
    try {
      await timeService.setFace(descriptor)
      message.success('Лицо зарегистрировано! Теперь можно отмечаться.')
      setHasFace(true)
      setFaceDescriptor(descriptor)
      setFaceModal(null)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось сохранить')
    }
  }

  const onFaceVerified = async () => {
    const action = pendingAction
    setFaceModal(null)
    setPendingAction(null)
    if (!action) return

    try {
      if (action === 'in') {
        await timeService.checkIn('FACE')
        message.success('Добро пожаловать! Хорошего дня 🌿')
      } else {
        await timeService.checkOut()
        message.success('До свидания! Хорошего отдыха 👋')
      }
      await reload()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось отметиться')
    }
  }

  const initials =
    user?.fullName
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?'

  if (loading && !summary) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <SproutPageHeader
        title="Мой кабинет"
        icon={<Clock size={22} strokeWidth={2} />}
        iconAccent="mint"
        description={`${dayjs().format('dddd, D MMMM')} · приход/уход через Face ID`}
      />

      {/* Центральный блок check-in/out */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SproutCard
              padding={28}
              style={{
                background: isWorking
                  ? `linear-gradient(135deg, ${SP.primarySoft}, ${SP.yellowSoft})`
                  : SP.surface,
                textAlign: 'center',
              }}
            >
              {/* Аватар */}
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                  background: isWorking
                    ? `linear-gradient(135deg, ${SP.primary}, ${SP.primaryDeep})`
                    : SP.surfaceAlt,
                  color: isWorking ? 'white' : SP.muted,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 28,
                  fontWeight: 800,
                  boxShadow: isWorking
                    ? '0 8px 24px -8px rgba(79,178,134,0.5)'
                    : 'none',
                }}
              >
                {initials}
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: SP.text,
                  marginBottom: 4,
                }}
              >
                {user?.fullName}
              </div>
              <div style={{ fontSize: 12, color: SP.muted, marginBottom: 20 }}>
                {isWorking ? '🟢 На работе сейчас' : '⚪ Не на работе'}
              </div>

              {/* Таймер */}
              {isWorking && elapsedToday && (
                <div
                  className="sp-num"
                  style={{
                    fontSize: 44,
                    fontWeight: 800,
                    color: SP.primaryDeep,
                    lineHeight: 1,
                    marginBottom: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(elapsedToday.h).padStart(2, '0')}:
                  {String(elapsedToday.m).padStart(2, '0')}:
                  {String(elapsedToday.s).padStart(2, '0')}
                </div>
              )}
              {isWorking && activeCheckIn && (
                <div style={{ fontSize: 12, color: SP.muted, marginBottom: 20 }}>
                  Пришли в {dayjs(activeCheckIn).format('HH:mm')}
                </div>
              )}

              {/* Кнопка */}
              {isWorking ? (
                <Button
                  type="primary"
                  size="large"
                  danger
                  icon={<LogOut size={18} />}
                  onClick={() => handleClick('out')}
                  style={{
                    width: '100%',
                    height: 56,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  Я ухожу
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon={<LogIn size={18} />}
                  onClick={() => handleClick('in')}
                  style={{
                    width: '100%',
                    height: 56,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  Я пришёл
                </Button>
              )}

              {!hasFace && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 10,
                    background: SP.yellowSoft,
                    borderRadius: 10,
                    fontSize: 12,
                    color: SP.yellowDeep,
                    fontWeight: 600,
                  }}
                >
                  ⚠️ Сначала зарегистрируйте лицо для Face ID
                </div>
              )}
              {hasFace && (
                <Button
                  type="link"
                  icon={<Camera size={13} />}
                  onClick={() => setFaceModal('register')}
                  style={{ marginTop: 8, fontSize: 12 }}
                >
                  Перерегистрировать лицо
                </Button>
              )}
            </SproutCard>
          </motion.div>
        </Col>

        {/* Сводка за месяц */}
        <Col xs={24} lg={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Row gutter={[12, 12]}>
              <Col xs={12}>
                <SproutKPI
                  label="Часов в месяце"
                  value={`${summary?.totalHours ?? 0}ч`}
                  hint={`из ${summary?.workNorm ?? 176}ч плана`}
                  accent="mint"
                  icon={<Clock size={18} />}
                  delay={0}
                />
              </Col>
              <Col xs={12}>
                <SproutKPI
                  label="К выплате"
                  value={formatMoneyCompact(summary?.estimatedSalary ?? 0)}
                  hint={
                    summary?.salaryMode === 'HOURLY'
                      ? `${summary.hourlyRate} сом/ч`
                      : 'фикс. оклад'
                  }
                  accent="yellow"
                  icon={<Wallet size={18} />}
                  delay={0.05}
                />
              </Col>
            </Row>

            <SproutCard padding={18}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: SP.text }}>
                  Выполнение нормы
                </div>
                <div
                  className="sp-num"
                  style={{ fontSize: 14, fontWeight: 700, color: SP.primaryDeep }}
                >
                  {formatPercent(summary?.completionRate ?? 0)}
                </div>
              </div>
              <Progress
                percent={Math.round((summary?.completionRate ?? 0) * 100)}
                strokeColor={{
                  from: SP.primary,
                  to: SP.primaryDeep,
                }}
                showInfo={false}
                size="small"
              />
              <div
                style={{
                  fontSize: 11,
                  color: SP.muted,
                  marginTop: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{summary?.totalHours ?? 0}ч отработано</span>
                <span>{summary?.workNorm ?? 176}ч норма</span>
              </div>
            </SproutCard>

            <SproutCard padding={18}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    background: SP.blueSoft,
                    color: SP.blueDeep,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <TrendingUp size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: SP.muted }}>Режим зарплаты</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SP.text }}>
                    {summary?.salaryMode === 'HOURLY'
                      ? `Почасовая · ${summary?.hourlyRate} сом/ч`
                      : `Фикс. оклад · ${formatMoneyCompact(summary?.fixedSalary ?? 0)}`}
                  </div>
                </div>
              </div>
            </SproutCard>
          </div>
        </Col>
      </Row>

      {/* История по дням */}
      <SproutCard style={{ marginTop: 16 }} delay={0.2}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
            fontSize: 15,
            fontWeight: 700,
            color: SP.text,
          }}
        >
          <CalendarIcon size={16} />
          История за {dayjs(month + '-01').format('MMMM YYYY')}
        </div>
        {(summary?.entries.length ?? 0) === 0 ? (
          <SproutEmpty
            icon={<CalendarIcon size={28} strokeWidth={1.8} />}
            title="Записей пока нет"
            description="Ваша история появится после первой отметки прихода"
            minHeight={200}
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={summary?.entries}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            size="middle"
            columns={[
              {
                title: 'Дата',
                dataIndex: 'date',
                render: (v: string) => (
                  <span style={{ fontWeight: 600 }}>
                    {dayjs(v).format('DD.MM.YYYY')}
                  </span>
                ),
              },
              {
                title: 'Приход',
                dataIndex: 'checkIn',
                render: (v: string) => (
                  <span className="sp-num">{dayjs(v).format('HH:mm')}</span>
                ),
              },
              {
                title: 'Уход',
                dataIndex: 'checkOut',
                render: (v: string | null) =>
                  v ? (
                    <span className="sp-num">{dayjs(v).format('HH:mm')}</span>
                  ) : (
                    <Tag
                      style={{
                        background: SP.primaryGhost,
                        color: SP.primaryDeep,
                        border: 'none',
                      }}
                    >
                      Сейчас работаю
                    </Tag>
                  ),
              },
              {
                title: 'Отработано',
                dataIndex: 'minutesWorked',
                render: (v: number | null) =>
                  v != null ? (
                    <span
                      className="sp-num"
                      style={{ fontWeight: 600 }}
                    >{`${Math.floor(v / 60)}ч ${v % 60}м`}</span>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Метод',
                dataIndex: 'verifyMethod',
                render: (v: string) => {
                  const colors: Record<string, { bg: string; fg: string; label: string }> = {
                    FACE: { bg: SP.primaryGhost, fg: SP.primaryDeep, label: '👤 Face ID' },
                    MANUAL: { bg: SP.borderSoft, fg: SP.muted, label: '✋ Вручную' },
                    PIN: { bg: SP.blueSoft, fg: SP.blueDeep, label: '🔢 PIN' },
                    QR: { bg: SP.yellowSoft, fg: SP.yellowDeep, label: '📱 QR' },
                  }
                  const c = colors[v] || colors.MANUAL
                  return (
                    <Tag
                      style={{
                        background: c.bg,
                        color: c.fg,
                        border: 'none',
                        fontSize: 11,
                      }}
                    >
                      {c.label}
                    </Tag>
                  )
                },
              },
              {
                title: 'Заметка',
                dataIndex: 'note',
                render: (v: string | null) =>
                  v ? (
                    <Tooltip title={v}>
                      <span
                        style={{
                          display: 'inline-block',
                          maxWidth: 120,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: SP.muted,
                          fontSize: 12,
                        }}
                      >
                        {v}
                      </span>
                    </Tooltip>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        )}
      </SproutCard>

      {/* Face Modal */}
      <Modal
        title={faceModal === 'register' ? 'Регистрация лица' : 'Подтверждение Face ID'}
        open={faceModal !== null}
        onCancel={() => {
          setFaceModal(null)
          setPendingAction(null)
        }}
        footer={null}
        destroyOnClose
        width={420}
      >
        {faceModal && (
          <FaceCapture
            key={faceModal}
            mode={faceModal}
            verifyAgainst={faceDescriptor}
            onSuccess={
              faceModal === 'register' ? onFaceRegistered : onFaceVerified
            }
            onCancel={() => {
              setFaceModal(null)
              setPendingAction(null)
            }}
            height={280}
          />
        )}
      </Modal>
    </div>
  )
}
