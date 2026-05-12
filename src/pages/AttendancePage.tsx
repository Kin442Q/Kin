import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Segmented,
  App as AntdApp,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MedicineBoxOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs, { Dayjs } from 'dayjs'

import PageHeader from '../components/PageHeader'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { uid } from '../lib/uid'
import type { AttendanceStatus } from '../types'

const { Text } = Typography

const STATUS_LABEL: Record<AttendanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  present: { label: 'Присутствует', color: 'green', icon: <CheckCircleOutlined /> },
  absent: { label: 'Отсутствует', color: 'red', icon: <CloseCircleOutlined /> },
  sick: { label: 'Болеет', color: 'orange', icon: <MedicineBoxOutlined /> },
  vacation: { label: 'Отпуск', color: 'blue', icon: <CalendarOutlined /> },
}

export default function AttendancePage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const childrenAll = useDataStore((s) => s.children)
  const attendance = useDataStore((s) => s.attendance)
  const upsertAttendance = useDataStore((s) => s.upsertAttendance)
  const user = useAuthStore((s) => s.user)

  const [date, setDate] = useState<Dayjs>(dayjs())
  const [groupFilter, setGroupFilter] = useState<string | undefined>(
    user?.role === 'teacher' ? user.groupId : undefined,
  )

  const dateStr = date.format('YYYY-MM-DD')

  const children = useMemo(() => {
    let res = childrenAll
    if (user?.role === 'teacher') res = res.filter((c) => c.groupId === user.groupId)
    if (groupFilter) res = res.filter((c) => c.groupId === groupFilter)
    return res
  }, [childrenAll, user, groupFilter])

  const rows = useMemo(() => {
    return children.map((c) => {
      const rec = attendance.find((a) => a.childId === c.id && a.date === dateStr)
      return {
        key: c.id,
        child: c,
        record: rec,
        status: (rec?.status ?? 'present') as AttendanceStatus,
        group: groups.find((g) => g.id === c.groupId),
      }
    })
  }, [children, attendance, groups, dateStr])

  const stats = useMemo(() => {
    const acc: Record<AttendanceStatus, number> = { present: 0, absent: 0, sick: 0, vacation: 0 }
    rows.forEach((r) => {
      acc[r.status]++
    })
    return acc
  }, [rows])

  const setStatus = (childId: string, status: AttendanceStatus) => {
    const existing = attendance.find((a) => a.childId === childId && a.date === dateStr)
    upsertAttendance({
      id: existing?.id ?? uid(),
      childId,
      date: dateStr,
      status,
    })
  }

  const markAllPresent = () => {
    rows.forEach((r) => setStatus(r.child.id, 'present'))
    message.success('Все отмечены как присутствующие')
  }

  return (
    <div>
      <PageHeader
        title="Посещаемость"
        icon={<CheckCircleOutlined />}
        description={`Отметка посещаемости на ${date.format('DD.MM.YYYY')}`}
        actions={
          <Space>
            <DatePicker
              value={date}
              onChange={(d) => d && setDate(d)}
              allowClear={false}
              format="DD.MM.YYYY"
            />
            <Button type="primary" onClick={markAllPresent}>
              Все присутствуют
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard title="Присутствуют" value={stats.present} variant="success" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Отсутствуют" value={stats.absent} variant="danger" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Болеют" value={stats.sick} variant="warning" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="В отпуске" value={stats.vacation} variant="primary" />
        </Col>
      </Row>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4"
      >
        <Card className="glass" bordered={false}>
          <Row gutter={[12, 12]} className="mb-3">
            <Col xs={24} md={8}>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="Все группы"
                value={groupFilter}
                onChange={setGroupFilter}
                disabled={user?.role === 'teacher'}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Col>
          </Row>
          <Table
            rowKey="key"
            dataSource={rows}
            pagination={{ pageSize: 12 }}
            scroll={{ x: 700 }}
            columns={[
              {
                title: 'Ребёнок',
                key: 'child',
                render: (_, r) => (
                  <Space>
                    <Avatar size={32} style={{ background: r.group?.color || '#6366f1' }}>
                      {r.child.firstName[0]}
                    </Avatar>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {r.child.lastName} {r.child.firstName}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.group?.name || '—'}
                      </Text>
                    </div>
                  </Space>
                ),
              },
              {
                title: 'Статус',
                key: 'status',
                render: (_, r) => (
                  <Segmented
                    size="small"
                    value={r.status}
                    onChange={(v) => setStatus(r.child.id, v as AttendanceStatus)}
                    options={[
                      { value: 'present', label: STATUS_LABEL.present.label, icon: STATUS_LABEL.present.icon },
                      { value: 'absent', label: STATUS_LABEL.absent.label, icon: STATUS_LABEL.absent.icon },
                      { value: 'sick', label: STATUS_LABEL.sick.label, icon: STATUS_LABEL.sick.icon },
                      { value: 'vacation', label: STATUS_LABEL.vacation.label, icon: STATUS_LABEL.vacation.icon },
                    ]}
                  />
                ),
              },
              {
                title: 'Текущий',
                key: 'current',
                render: (_, r) => (
                  <Tag color={STATUS_LABEL[r.status].color} icon={STATUS_LABEL[r.status].icon}>
                    {STATUS_LABEL[r.status].label}
                  </Tag>
                ),
              },
            ]}
          />
        </Card>
      </motion.div>
    </div>
  )
}
