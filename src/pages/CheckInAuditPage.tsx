import { useEffect, useState } from 'react'
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { MapPin, Clock, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { SP, SproutPageHeader } from '../components/sprout'
import { useAuthStore } from '../store/authStore'
import { http } from '../api'

const { Text } = Typography
const { RangePicker } = DatePicker

interface CheckInEntry {
  id: string
  userId: string
  userName: string
  avatarUrl: string | null
  checkIn: string
  checkOut: string | null
  minutesWorked: number | null
  verifyMethod: 'MANUAL' | 'FACE' | 'PIN' | 'QR' | 'TERMINAL'
  lat: number | null
  lon: number | null
  distanceMeters: number | null
  note: string | null
}

export default function CheckInAuditPage() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const inst = user?.institution
  const radius = inst?.checkInRadiusMeters ?? 150

  const [from, setFrom] = useState<dayjs.Dayjs>(dayjs().subtract(7, 'day'))
  const [to, setTo] = useState<dayjs.Dayjs>(dayjs())
  const [items, setItems] = useState<CheckInEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await http.get<CheckInEntry[]>('/v1/time/audit', {
        params: {
          from: from.format('YYYY-MM-DD'),
          to: to.format('YYYY-MM-DD'),
          limit: 200,
        },
      })
      setItems(r.data)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  return (
    <div>
      <SproutPageHeader
        title="Журнал check-in"
        icon={<MapPin size={22} strokeWidth={2} />}
        iconAccent="blue"
        description="Кто, когда и откуда отметился. Координаты сохраняются для аудита геофенсинга."
        actions={
          <Space>
            <RangePicker
              value={[from, to]}
              onChange={(v) => {
                if (v && v[0] && v[1]) {
                  setFrom(v[0])
                  setTo(v[1])
                }
              }}
              format="DD.MM.YYYY"
            />
            <Button icon={<RefreshCw size={14} />} onClick={load} loading={loading}>
              Обновить
            </Button>
          </Space>
        }
      />

      {inst && inst.latitude != null && inst.longitude != null && (
        <Card
          className="glass"
          bordered={false}
          bodyStyle={{ padding: 12 }}
          style={{ marginBottom: 12 }}
        >
          <Space size={16} wrap>
            <span style={{ fontSize: 13, color: SP.muted }}>
              Точка учреждения:
            </span>
            <Tag style={{ background: SP.primaryGhost, color: SP.primaryDeep, border: 'none' }}>
              {inst.latitude.toFixed(6)}, {inst.longitude.toFixed(6)}
            </Tag>
            <Tag style={{ background: SP.surfaceAlt, border: 'none' }}>
              Радиус {radius} м
            </Tag>
            <a
              href={`https://www.google.com/maps?q=${inst.latitude},${inst.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Открыть на карте
            </a>
          </Space>
        </Card>
      )}

      {loading && items.length === 0 ? (
        <Card className="glass" bordered={false}>
          <Spin />
        </Card>
      ) : items.length === 0 ? (
        <Card className="glass" bordered={false}>
          <Empty
            description="Записей check-in нет за выбранный период"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((e) => {
              const outside =
                e.distanceMeters != null && e.distanceMeters > radius
              const distLabel =
                e.distanceMeters != null
                  ? e.distanceMeters >= 1000
                    ? (e.distanceMeters / 1000).toFixed(1) + ' км'
                    : e.distanceMeters + ' м'
                  : '—'
              return (
                <Row
                  key={e.id}
                  gutter={[12, 8]}
                  align="middle"
                  style={{
                    margin: 0,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${SP.borderSoft}`,
                    background: SP.surface,
                  }}
                >
                  <Col flex="40px">
                    <Avatar
                      style={{
                        background: SP.primarySoft,
                        color: SP.primaryDeep,
                        fontWeight: 700,
                      }}
                    >
                      {e.userName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
                    </Avatar>
                  </Col>
                  <Col xs={24} sm={6}>
                    <div style={{ fontWeight: 700, color: SP.text }}>
                      {e.userName}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {e.verifyMethod === 'FACE' && '🔐 Face ID'}
                      {e.verifyMethod === 'MANUAL' && 'Вручную'}
                      {e.verifyMethod === 'PIN' && 'PIN'}
                      {e.verifyMethod === 'QR' && 'QR'}
                      {e.verifyMethod === 'TERMINAL' && 'Терминал'}
                    </Text>
                  </Col>
                  <Col xs={12} sm={5}>
                    <Space size={4}>
                      <Clock size={12} color={SP.muted} />
                      <Text style={{ fontSize: 13 }}>
                        {dayjs(e.checkIn).format('D MMM, HH:mm')}
                      </Text>
                    </Space>
                    {e.checkOut && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          до {dayjs(e.checkOut).format('HH:mm')}
                          {e.minutesWorked != null &&
                            ` · ${Math.round(e.minutesWorked / 60 * 10) / 10}ч`}
                        </Text>
                      </div>
                    )}
                  </Col>
                  <Col xs={12} sm={6}>
                    {e.lat != null && e.lon != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${e.lat},${e.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12 }}
                      >
                        {e.lat.toFixed(5)}, {e.lon.toFixed(5)}
                      </a>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        нет координат
                      </Text>
                    )}
                  </Col>
                  <Col xs={24} sm={5} style={{ textAlign: 'right' }}>
                    {e.distanceMeters != null ? (
                      <Tag
                        style={{
                          background: outside ? '#FCEAE5' : SP.primaryGhost,
                          color: outside ? SP.danger : SP.primaryDeep,
                          border: 'none',
                          fontWeight: 700,
                          margin: 0,
                        }}
                      >
                        {outside ? '⚠ ' : '✓ '}
                        {distLabel}
                      </Tag>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        без гео
                      </Text>
                    )}
                  </Col>
                </Row>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
