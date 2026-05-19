import { useEffect, useMemo, useState } from 'react'
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
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { SP, SproutPageHeader } from '../../components/sprout'
import KidSwitcher from '../../components/parent/KidSwitcher'
import {
  parentApi,
  type ParentKid,
  type ParentPayment,
} from '../../api/parentApi'

const { Text } = Typography

const MONTH_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return `${MONTH_RU[mo - 1]} ${y}`
}
function methodLabel(m: string | null) {
  if (m === 'CASH') return 'Наличные'
  if (m === 'CARD') return 'Карта'
  if (m === 'TRANSFER') return 'Перевод'
  return ''
}

export default function ParentPaymentsPage() {
  const { message } = AntdApp.useApp()
  const [kids, setKids] = useState<ParentKid[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [payments, setPayments] = useState<ParentPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    parentApi
      .myKids()
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
      .payments(activeKidId)
      .then(setPayments)
      .catch((e) =>
        message.error(e?.response?.data?.message || 'Ошибка'),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKidId])

  const totals = useMemo(() => {
    let paid = 0
    let due = 0
    let paidCount = 0
    for (const p of payments) {
      const amount = Number(p.amount)
      if (p.paid) {
        paid += amount
        paidCount++
      } else {
        due += amount
      }
    }
    return { paid, due, paidCount, dueCount: payments.length - paidCount }
  }, [payments])

  return (
    <div>
      <SproutPageHeader
        title="Оплата"
        icon={<Wallet size={22} strokeWidth={2} />}
        iconAccent="rose"
        description="История платежей и текущий долг"
      />

      <KidSwitcher kids={kids} value={activeKidId} onChange={setActiveKidId} />

      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12}>
          <Card
            className="glass"
            bordered={false}
            bodyStyle={{ padding: 16, background: SP.primarySoft }}
          >
            <Space>
              <CheckCircleOutlined style={{ color: SP.primaryDeep, fontSize: 18 }} />
              <Text style={{ color: SP.primaryDeep, fontWeight: 700 }}>Оплачено</Text>
            </Space>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: SP.primaryDeep,
                marginTop: 6,
              }}
            >
              {Math.round(totals.paid).toLocaleString('ru-RU')}{' '}
              <span style={{ fontSize: 14, opacity: 0.6 }}>с</span>
            </div>
            <Text style={{ color: SP.primaryDeep, fontSize: 12 }}>
              {totals.paidCount} платежей
            </Text>
          </Card>
        </Col>
        <Col xs={12}>
          <Card
            className="glass"
            bordered={false}
            bodyStyle={{
              padding: 16,
              background: totals.due > 0 ? '#FCEAE5' : SP.surface,
            }}
          >
            <Space>
              <ExclamationCircleOutlined
                style={{
                  color: totals.due > 0 ? SP.danger : SP.muted,
                  fontSize: 18,
                }}
              />
              <Text
                style={{
                  color: totals.due > 0 ? SP.danger : SP.muted,
                  fontWeight: 700,
                }}
              >
                К оплате
              </Text>
            </Space>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: totals.due > 0 ? SP.danger : SP.muted,
                marginTop: 6,
              }}
            >
              {Math.round(totals.due).toLocaleString('ru-RU')}{' '}
              <span style={{ fontSize: 14, opacity: 0.6 }}>с</span>
            </div>
            <Text
              style={{
                color: totals.due > 0 ? SP.danger : SP.muted,
                fontSize: 12,
              }}
            >
              {totals.dueCount} не оплачено
            </Text>
          </Card>
        </Col>
      </Row>

      {loading ? (
        <Card className="glass" bordered={false}>
          <Spin />
        </Card>
      ) : payments.length === 0 ? (
        <Card className="glass" bordered={false}>
          <Empty description="Платежей пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="glass" bordered={false} title="История платежей">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${SP.borderSoft}`,
                    background: SP.surface,
                  }}
                >
                  <Avatar
                    style={{
                      background: p.paid ? SP.primarySoft : '#FCEAE5',
                      color: p.paid ? SP.primaryDeep : SP.danger,
                    }}
                    icon={<Wallet size={18} />}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: SP.text }}>
                      {monthLabel(p.month)}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {p.paid
                        ? `Оплачено${
                            p.paidAt
                              ? ' · ' + dayjs(p.paidAt).format('D MMM YYYY')
                              : ''
                          }`
                        : 'Не оплачено'}
                      {p.method && ` · ${methodLabel(p.method)}`}
                    </Text>
                    {p.comment && (
                      <div
                        style={{
                          fontSize: 12,
                          color: SP.muted,
                          marginTop: 4,
                          fontStyle: 'italic',
                        }}
                      >
                        {p.comment}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: p.paid ? SP.text : SP.danger,
                    }}
                  >
                    {Math.round(Number(p.amount)).toLocaleString('ru-RU')} с
                  </div>
                  {!p.paid && <Tag color="red">долг</Tag>}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
