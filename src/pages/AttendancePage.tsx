import { useEffect, useMemo, useState } from 'react'
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

import { ClipboardCheck } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
import StatCard from '../components/ui/StatCard'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { http } from '../api'
import type { AttendanceStatus } from '../types'

const { Text } = Typography

type StatusApi = 'PRESENT' | 'ABSENT' | 'SICK' | 'VACATION'

const STATUS_LABEL: Record<
  AttendanceStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  present: {
    label: 'Присутствует',
    color: 'green',
    icon: <CheckCircleOutlined />,
  },
  absent: {
    label: 'Отсутствует',
    color: 'red',
    icon: <CloseCircleOutlined />,
  },
  sick: {
    label: 'Болеет',
    color: 'orange',
    icon: <MedicineBoxOutlined />,
  },
  vacation: {
    label: 'Отпуск',
    color: 'blue',
    icon: <CalendarOutlined />,
  },
}

function toApi(s: AttendanceStatus): StatusApi {
  return s.toUpperCase() as StatusApi
}
function fromApi(s: StatusApi): AttendanceStatus {
  return s.toLowerCase() as AttendanceStatus
}

interface AttendanceApi {
  id: string
  studentId: string
  groupId: string
  date: string
  status: StatusApi
  note: string | null
}

export default function AttendancePage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const childrenAll = useDataStore((s) => s.children)
  const user = useAuthStore((s) => s.user)

  const [date, setDate] = useState<Dayjs>(dayjs())
  const [groupFilter, setGroupFilter] = useState<string | undefined>(
    user?.role === 'teacher' ? user.groupId : undefined,
  )

  const [records, setRecords] = useState<AttendanceApi[]>([])
  const [loading, setLoading] = useState(false)

  const dateStr = date.format('YYYY-MM-DD')

  const loadAttendance = async () => {
    if (!user) return
    try {
      setLoading(true)
      const res = await http.get<AttendanceApi[]>('/v1/attendance', {
        params: {
          date: dateStr,
          ...(groupFilter ? { groupId: groupFilter } : {}),
        },
      })
      setRecords(res.data || [])
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось загрузить посещаемость'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttendance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, groupFilter])

  const children = useMemo(() => {
    let res = childrenAll
    if (user?.role === 'teacher')
      res = res.filter((c) => c.groupId === user.groupId)
    if (groupFilter) res = res.filter((c) => c.groupId === groupFilter)
    return res
  }, [childrenAll, user, groupFilter])

  const rows = useMemo(() => {
    return children.map((c) => {
      const rec = records.find((a) => a.studentId === c.id)
      return {
        key: c.id,
        child: c,
        record: rec,
        status: (rec ? fromApi(rec.status) : 'present') as AttendanceStatus,
        group: groups.find((g) => g.id === c.groupId),
      }
    })
  }, [children, records, groups])

  const stats = useMemo(() => {
    const acc: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      sick: 0,
      vacation: 0,
    }
    rows.forEach((r) => {
      acc[r.status]++
    })
    return acc
  }, [rows])

  const setStatus = async (
    studentId: string,
    status: AttendanceStatus,
  ) => {
    try {
      await http.post('/v1/attendance/mark', {
        studentId,
        date: dateStr,
        status: toApi(status),
      })
      await loadAttendance()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось отметить'
      message.error(msg)
    }
  }

  const markAllPresent = async () => {
    try {
      await Promise.all(
        rows.map((r) =>
          http.post('/v1/attendance/mark', {
            studentId: r.child.id,
            date: dateStr,
            status: 'PRESENT',
          }),
        ),
      )
      await loadAttendance()
      message.success('Все отмечены как присутствующие')
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Ошибка массовой отметки'
      message.error(msg)
    }
  }

  return (
    <div>
      <SproutPageHeader
        title="Посещаемость"
        icon={<ClipboardCheck size={22} strokeWidth={2} />}
        iconAccent="lilac"
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
          <StatCard
            title="Присутствуют"
            value={stats.present}
            variant="success"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Отсутствуют" value={stats.absent} variant="danger" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Болеют" value={stats.sick} variant="warning" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="В отпуске"
            value={stats.vacation}
            variant="primary"
          />
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
                options={groups.map((g) => ({
                  value: g.id,
                  label: g.name,
                }))}
              />
            </Col>
          </Row>
          <Table
            rowKey="key"
            loading={loading}
            dataSource={rows}
            pagination={{ pageSize: 12 }}
            scroll={{ x: 700 }}
            columns={[
              {
                title: 'Ребёнок',
                key: 'child',
                render: (_, r) => (
                  <Space>
                    <Avatar
                      size={32}
                      style={{ background: r.group?.color || '#6366f1' }}
                    >
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
                    onChange={(v) =>
                      setStatus(r.child.id, v as AttendanceStatus)
                    }
                    options={[
                      {
                        value: 'present',
                        label: STATUS_LABEL.present.label,
                        icon: STATUS_LABEL.present.icon,
                      },
                      {
                        value: 'absent',
                        label: STATUS_LABEL.absent.label,
                        icon: STATUS_LABEL.absent.icon,
                      },
                      {
                        value: 'sick',
                        label: STATUS_LABEL.sick.label,
                        icon: STATUS_LABEL.sick.icon,
                      },
                      {
                        value: 'vacation',
                        label: STATUS_LABEL.vacation.label,
                        icon: STATUS_LABEL.vacation.icon,
                      },
                    ]}
                  />
                ),
              },
              {
                title: 'Текущий',
                key: 'current',
                render: (_, r) => (
                  <Tag
                    color={STATUS_LABEL[r.status].color}
                    icon={STATUS_LABEL[r.status].icon}
                  >
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
