import { useEffect, useState } from 'react'
import {
  App as AntdApp,
  Avatar,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'
import {
  Baby,
  Coffee,
  Soup,
  Cookie,
  Sparkles,
  StickyNote,
  BookOpen,
  Wallet,
  Clock,
} from 'lucide-react'

import { SP, SproutPageHeader, SproutEmpty } from '../../components/sprout'
import KidSwitcher from '../../components/parent/KidSwitcher'
import { useAuthStore } from '../../store/authStore'
import { parentApi, type ParentKid, type ParentToday } from '../../api/parentApi'

const { Text, Title } = Typography

const ATTENDANCE_META = {
  PRESENT: { label: 'В саду', color: SP.primaryDeep, bg: SP.primarySoft, emoji: '🟢' },
  ABSENT: { label: 'Нет', color: SP.danger, bg: '#FCEAE5', emoji: '🔴' },
  SICK: { label: 'Болеет', color: SP.yellowDeep, bg: SP.yellowSoft, emoji: '🤒' },
  VACATION: { label: 'В отпуске', color: SP.lilacDeep, bg: SP.lilacSoft, emoji: '🌴' },
} as const

function moodLabel(m: 'HAPPY' | 'NEUTRAL' | 'SAD' | 'SICK'): string {
  return m === 'HAPPY' ? '😊 хорошее'
    : m === 'NEUTRAL' ? '😐 обычное'
    : m === 'SAD' ? '😟 грустное'
    : '🤒 болел(а)'
}
function napLabel(n: 'GOOD' | 'NORMAL' | 'POOR' | 'NO_NAP'): string {
  return n === 'GOOD' ? 'хорошо спал(а)'
    : n === 'NORMAL' ? 'обычно'
    : n === 'POOR' ? 'плохо спал(а)'
    : 'не спал(а)'
}

export default function ParentHomePage() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const isSchool = user?.institution?.type === 'SCHOOL'

  const [kids, setKids] = useState<ParentKid[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [today, setToday] = useState<ParentToday | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    parentApi.myKids()
      .then((list) => {
        setKids(list)
        if (list.length) setActiveKidId(list[0].id)
        else setLoading(false)
      })
      .catch((e) => {
        message.error(e?.response?.data?.message || 'Не удалось загрузить детей')
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeKidId) return
    setLoading(true)
    parentApi
      .today(activeKidId)
      .then(setToday)
      .catch((e) =>
        message.error(e?.response?.data?.message || 'Не удалось загрузить'),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKidId])

  if (loading && !today) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!kids.length) {
    return (
      <div>
        <SproutPageHeader
          title={`Доброе утро, ${user?.fullName ?? ''}`}
          icon={<Baby size={22} strokeWidth={2} />}
          iconAccent="mint"
        />
        <Card className="glass" bordered={false}>
          <SproutEmpty
            icon={<Baby size={32} strokeWidth={1.8} />}
            title="Нет привязанных детей"
            description={`Обратитесь к администратору ${isSchool ? 'школы' : 'сада'}.`}
            minHeight={200}
          />
        </Card>
      </div>
    )
  }

  const kid = today?.kid ?? kids[0]
  const attendance = today?.today.attendance
  const meta = attendance ? ATTENDANCE_META[attendance.status] : null
  const diary = today?.today.diary
  const kidNote = today?.today.kidNote
  const lessons = today?.today.schedule ?? []
  const lastPayment = today?.lastPayment

  return (
    <div>
      <SproutPageHeader
        title={`Здравствуйте, ${user?.fullName ?? ''}`}
        icon={<Baby size={22} strokeWidth={2} />}
        iconAccent="mint"
        description={dayjs().format('dddd, D MMMM')}
      />

      <KidSwitcher kids={kids} value={activeKidId} onChange={setActiveKidId} />

      <Row gutter={[16, 16]}>
        {/* Карточка ребёнка */}
        <Col xs={24} md={10}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="glass" bordered={false}>
              <Space size={14} align="center" style={{ marginBottom: 14 }}>
                <Avatar
                  size={56}
                  style={{
                    background: SP.primarySoft,
                    color: SP.primaryDeep,
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  {kid.firstName[0]}
                  {kid.lastName[0]}
                </Avatar>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {kid.firstName}
                  </Title>
                  <Text type="secondary">
                    {isSchool ? 'Класс' : 'Группа'} «{kid.group?.name ?? '—'}»
                    {kid.group?.ageRange ? ` · ${kid.group.ageRange}` : ''}
                  </Text>
                </div>
              </Space>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: meta?.bg ?? SP.surfaceAlt,
                  color: meta?.color ?? SP.muted,
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                {meta
                  ? `${meta.emoji} ${meta.label}`
                  : `⚪ ${isSchool ? 'Учитель' : 'Воспитатель'} ещё не отметил`}
              </div>

              {lastPayment && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${SP.borderSoft}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Wallet size={20} color={SP.primaryDeep} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700 }}>
                      {lastPayment.paid ? 'Оплачено' : 'К оплате'} · {lastPayment.month}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: SP.text }}>
                      {Math.round(Number(lastPayment.amount)).toLocaleString('ru-RU')}{' '}
                      <span style={{ color: SP.muted, fontSize: 14 }}>с</span>
                    </div>
                  </div>
                  {!lastPayment.paid && <Tag color="red">долг</Tag>}
                </div>
              )}
            </Card>
          </motion.div>
        </Col>

        {/* Дневник за сегодня (если есть) */}
        <Col xs={24} md={14}>
          {(diary || kidNote) ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
            >
              <Card
                className="glass"
                bordered={false}
                title={
                  <Space>
                    <BookOpen size={18} />
                    <span>Дневник за сегодня</span>
                  </Space>
                }
              >
                {diary?.breakfast && (
                  <DiaryRow icon={<Coffee size={14} color={SP.primaryDeep} />} bg={SP.primarySoft} label="Завтрак" text={diary.breakfast} />
                )}
                {diary?.lunch && (
                  <DiaryRow icon={<Soup size={14} color={SP.yellowDeep} />} bg={SP.yellowSoft} label="Обед" text={diary.lunch} />
                )}
                {diary?.snack && (
                  <DiaryRow icon={<Cookie size={14} color={SP.danger} />} bg="#FCEAE5" label="Полдник" text={diary.snack} />
                )}
                {diary?.activities && (
                  <DiaryRow icon={<Sparkles size={14} color={SP.blueDeep} />} bg={SP.blueSoft} label="Активности" text={diary.activities} />
                )}
                {diary?.note && (
                  <DiaryRow icon={<StickyNote size={14} color={SP.lilacDeep} />} bg={SP.lilacSoft} label="Заметка" text={diary.note} />
                )}
                {kidNote && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: `1px solid ${SP.borderSoft}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: SP.primaryDeep, fontWeight: 700, marginBottom: 4 }}>
                      О {kid.firstName.toUpperCase()}
                    </div>
                    {kidNote.mood && (
                      <div style={{ fontSize: 13, color: SP.text }}>
                        Настроение: {moodLabel(kidNote.mood)}
                      </div>
                    )}
                    {kidNote.napQuality && (
                      <div style={{ fontSize: 13, color: SP.text }}>
                        Сон: {napLabel(kidNote.napQuality)}
                      </div>
                    )}
                    {kidNote.note && (
                      <div style={{ fontSize: 13, color: SP.text, fontStyle: 'italic', marginTop: 4 }}>
                        «{kidNote.note}»
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          ) : (
            <Card className="glass" bordered={false}>
              <Empty
                description={`${isSchool ? 'Учитель' : 'Воспитатель'} ещё не заполнил дневник на сегодня`}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}
        </Col>

        {/* Сегодня в саду/школе — расписание */}
        <Col xs={24}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <Card
              className="glass"
              bordered={false}
              title={`Сегодня ${isSchool ? 'в школе' : 'в саду'}`}
            >
              {lessons.length === 0 ? (
                <Empty
                  description="На сегодня занятий нет"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lessons.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderRadius: 12,
                        background: SP.surface,
                        border: `1px solid ${SP.borderSoft}`,
                      }}
                    >
                      <Clock size={14} color={SP.primaryDeep} />
                      <span style={{ fontWeight: 700, color: SP.primaryDeep, minWidth: 56 }}>
                        {l.startTime}
                      </span>
                      <span style={{ flex: 1, fontWeight: 600 }}>
                        {l.subject?.name ?? l.activity}
                      </span>
                      {l.room && <Tag>каб. {l.room}</Tag>}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        до {l.endTime}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  )
}

function DiaryRow({
  icon,
  bg,
  label,
  text,
}: {
  icon: React.ReactNode
  bg: string
  label: string
  text: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 14, color: SP.text }}>{text}</div>
      </div>
    </div>
  )
}
