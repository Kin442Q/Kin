import { useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Card,
  Empty,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

import { SP, SproutPageHeader } from '../../components/sprout'
import KidSwitcher from '../../components/parent/KidSwitcher'
import { useAuthStore } from '../../store/authStore'
import {
  parentApi,
  type ParentKid,
  type ParentScheduleItem,
} from '../../api/parentApi'

const { Text } = Typography

const DAYS_FULL: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
}
const DAYS_SHORT: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
}

function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) return ''
  if (mins < 60) return `${mins} мин`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

export default function ParentSchedulePage() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const isSchool = user?.institution?.type === 'SCHOOL'

  const [kids, setKids] = useState<ParentKid[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [items, setItems] = useState<ParentScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const todayDow = ((new Date().getDay() + 6) % 7) + 1
  const [day, setDay] = useState<number>(todayDow)

  useEffect(() => {
    parentApi.myKids()
      .then((l) => {
        setKids(l)
        if (l.length) setActiveKidId(l[0].id)
        else setLoading(false)
      })
      .catch((e) => {
        message.error(e?.response?.data?.message || 'Ошибка')
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeKidId) return
    setLoading(true)
    parentApi
      .schedule(activeKidId)
      .then(setItems)
      .catch((e) =>
        message.error(e?.response?.data?.message || 'Ошибка'),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKidId])

  const dayItems = useMemo(
    () =>
      items
        .filter((i) => i.dayOfWeek === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [items, day],
  )

  return (
    <div>
      <SproutPageHeader
        title={isSchool ? 'Расписание уроков' : 'Расписание'}
        icon={<Calendar size={22} strokeWidth={2} />}
        iconAccent="blue"
      />

      <KidSwitcher kids={kids} value={activeKidId} onChange={setActiveKidId} />

      <Segmented
        block
        value={day}
        onChange={(v) => setDay(Number(v))}
        options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({
          value: d,
          label: (
            <div style={{ padding: '2px 0' }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{DAYS_SHORT[d]}</div>
              {d === todayDow && (
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    background: 'currentColor',
                    margin: '2px auto 0',
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
          ),
        }))}
        style={{ marginBottom: 14 }}
      />

      <Text type="secondary" style={{ fontSize: 13 }}>
        {DAYS_FULL[day]}
      </Text>

      {loading ? (
        <Card className="glass" bordered={false} style={{ marginTop: 12 }}>
          <Spin />
        </Card>
      ) : dayItems.length === 0 ? (
        <Card className="glass" bordered={false} style={{ marginTop: 12 }}>
          <Empty
            description={`На ${DAYS_FULL[day].toLowerCase()} ${isSchool ? 'уроков' : 'занятий'} нет`}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {dayItems.map((l) => (
            <Card key={l.id} className="glass" bordered={false} bodyStyle={{ padding: 14 }}>
              <Space size={14} style={{ width: '100%' }}>
                <div style={{ minWidth: 64, textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: l.subject?.color ?? SP.primaryDeep,
                      letterSpacing: -0.5,
                    }}
                  >
                    {l.startTime}
                  </div>
                  <div style={{ fontSize: 11, color: SP.muted }}>{l.endTime}</div>
                </div>
                <div
                  style={{
                    width: 1,
                    height: 36,
                    background: SP.borderSoft,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>
                    {l.subject?.name ?? l.activity}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {durationLabel(l.startTime, l.endTime)}
                    {l.room && <> · каб. {l.room}</>}
                  </Text>
                </div>
                {l.subject && (
                  <Tag
                    style={{
                      background: l.subject.color,
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                    }}
                  >
                    {l.subject.name}
                  </Tag>
                )}
              </Space>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  )
}
