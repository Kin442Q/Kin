import { useEffect, useState } from 'react'
import { App as AntdApp, Spin, Table, Tag } from 'antd'
import { GraduationCap } from 'lucide-react'
import dayjs from 'dayjs'

import { SP, SproutCard, SproutEmpty, SproutPageHeader } from '../../components/sprout'
import { studentApi, type StudentGrade, type StudentGrades } from '../../api/schoolApi'

const gradeColor = (v: number) => (v >= 9 ? 'green' : v >= 7 ? 'cyan' : v >= 5 ? 'orange' : 'red')

/** Мои оценки и средний балл по предметам. */
export default function StudentGradesPage() {
  const { message } = AntdApp.useApp()
  const [data, setData] = useState<StudentGrades | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    studentApi
      .grades()
      .then(setData)
      .catch((e) => message.error(e?.response?.data?.message || 'Не удалось загрузить оценки'))
      .finally(() => setLoading(false))
  }, [message])

  return (
    <div>
      <SproutPageHeader
        title="Мои оценки"
        icon={<GraduationCap size={22} strokeWidth={2} />}
        iconAccent="mint"
        description="Оценки по предметам и средний балл"
      />

      <Spin spinning={loading}>
        {!data || data.items.length === 0 ? (
          <SproutCard>
            <SproutEmpty
              icon={<GraduationCap size={32} strokeWidth={1.8} />}
              title="Оценок пока нет"
              description="Они появятся, как только учителя начнут их выставлять"
              minHeight={200}
            />
          </SproutCard>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
              {data.averages.map((a) => (
                <SproutCard key={a.subject.id} padding={14}>
                  <div style={{ fontSize: 12, color: SP.muted, fontWeight: 600 }}>{a.subject.name}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: a.subject.color }}>{a.average}</div>
                  <div style={{ fontSize: 11, color: SP.muted }}>оценок: {a.count}</div>
                </SproutCard>
              ))}
            </div>

            <SproutCard style={{ marginTop: 16 }}>
              <Table<StudentGrade>
                rowKey="id"
                size="small"
                pagination={{ pageSize: 15, hideOnSinglePage: true }}
                dataSource={data.items}
                columns={[
                  { title: 'Дата', dataIndex: 'date', width: 110, render: (d: string) => dayjs(d).format('DD.MM.YYYY') },
                  {
                    title: 'Предмет',
                    key: 'subject',
                    render: (_, g) => <Tag style={{ background: g.subject.color, color: '#fff', border: 'none' }}>{g.subject.name}</Tag>,
                  },
                  {
                    title: 'Оценка',
                    dataIndex: 'value',
                    width: 90,
                    render: (v: number) => <Tag color={gradeColor(v)}>{v}</Tag>,
                  },
                  { title: 'Комментарий', dataIndex: 'comment', render: (c: string | null) => c || '—' },
                ]}
              />
            </SproutCard>
          </>
        )}
      </Spin>
    </div>
  )
}
