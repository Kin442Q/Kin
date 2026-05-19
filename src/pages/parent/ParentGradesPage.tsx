import { useEffect, useState } from 'react'
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
import dayjs from 'dayjs'
import { GraduationCap, BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'

import { SP, SproutPageHeader } from '../../components/sprout'
import KidSwitcher from '../../components/parent/KidSwitcher'
import {
  parentApi,
  type ParentKid,
  type ParentGrade,
  type ParentGradeStats,
  type ParentHomework,
} from '../../api/parentApi'

const { Text } = Typography

function gradeColor(v: number): string {
  if (v >= 9) return SP.primaryDeep
  if (v >= 7) return SP.primary
  if (v >= 4) return SP.yellowDeep
  return SP.danger
}
function gradeTypeLabel(t: string): string {
  if (t === 'CLASSWORK') return 'урок'
  if (t === 'HOMEWORK') return 'ДЗ'
  if (t === 'CONTROL') return 'контр.'
  if (t === 'EXAM') return 'экзамен'
  if (t === 'PROJECT') return 'проект'
  return 'другое'
}

export default function ParentGradesPage() {
  const { message } = AntdApp.useApp()
  const [kids, setKids] = useState<ParentKid[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [grades, setGrades] = useState<ParentGrade[]>([])
  const [stats, setStats] = useState<ParentGradeStats[]>([])
  const [homework, setHomework] = useState<ParentHomework[]>([])
  const [tab, setTab] = useState<'grades' | 'homework'>('grades')
  const [loading, setLoading] = useState(true)

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
    Promise.all([
      parentApi.grades(activeKidId),
      parentApi.gradeStats(activeKidId),
      parentApi.homework(activeKidId),
    ])
      .then(([g, s, h]) => {
        setGrades(g)
        setStats(s)
        setHomework(h)
      })
      .catch((e) =>
        message.error(e?.response?.data?.message || 'Ошибка'),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKidId])

  return (
    <div>
      <SproutPageHeader
        title="Школа"
        icon={<GraduationCap size={22} strokeWidth={2} />}
        iconAccent="mint"
        description="Оценки и домашние задания"
      />

      <KidSwitcher kids={kids} value={activeKidId} onChange={setActiveKidId} />

      <Segmented
        block
        value={tab}
        onChange={(v) => setTab(v as 'grades' | 'homework')}
        options={[
          { value: 'grades', label: '📊 Оценки' },
          { value: 'homework', label: '📚 Домашка' },
        ]}
        style={{ marginBottom: 14 }}
      />

      {loading ? (
        <Card className="glass" bordered={false}>
          <Spin />
        </Card>
      ) : tab === 'grades' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {stats.length > 0 && (
            <Card
              className="glass"
              bordered={false}
              title="Средние оценки по предметам"
              style={{ marginBottom: 12 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 10,
                }}
              >
                {stats.map((row) => (
                  <div
                    key={row.subjectId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${SP.borderSoft}`,
                      background: SP.surface,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background: row.color,
                        marginRight: 10,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: SP.text }}>
                        {row.name}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {row.count} оц.
                      </Text>
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: gradeColor(row.average),
                      }}
                    >
                      {row.average.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {grades.length === 0 ? (
            <Card className="glass" bordered={false}>
              <Empty description="Оценок пока нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <Card className="glass" bordered={false} title="История">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grades.map((g) => (
                  <div
                    key={g.id}
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
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        background: gradeColor(g.value),
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {g.value}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: SP.text }}>
                        {g.subject?.name ?? '—'}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(g.date).format('D MMM')} · {gradeTypeLabel(g.type)}
                        {g.author && ` · ${g.author.fullName}`}
                      </Text>
                      {g.comment && (
                        <div
                          style={{
                            fontSize: 12,
                            color: SP.muted,
                            fontStyle: 'italic',
                            marginTop: 4,
                          }}
                        >
                          «{g.comment}»
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {homework.length === 0 ? (
            <Card className="glass" bordered={false}>
              <Empty description="Заданий нет" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {homework.map((h) => {
                const overdue =
                  new Date(h.dueDate).getTime() < Date.now() - 24 * 3600 * 1000
                return (
                  <Card
                    key={h.id}
                    className="glass"
                    bordered={false}
                    bodyStyle={{ padding: 14, opacity: overdue ? 0.55 : 1 }}
                  >
                    <Space size={14} align="start">
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          background: h.subject?.color ?? SP.primary,
                          marginTop: 6,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <Space wrap>
                          <Tag
                            style={{
                              background: h.subject?.color ?? SP.primary,
                              color: '#fff',
                              border: 'none',
                              fontWeight: 700,
                            }}
                          >
                            {h.subject?.name ?? '—'}
                          </Tag>
                          {overdue && <Tag color="red">просрочено</Tag>}
                        </Space>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: SP.text,
                            marginTop: 6,
                          }}
                        >
                          {h.title}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <BookOpen size={12} style={{ verticalAlign: 'middle' }} />{' '}
                          до {dayjs(h.dueDate).format('dd, D MMM')}
                        </Text>
                        {h.description && (
                          <div
                            style={{
                              fontSize: 13,
                              color: SP.textMid,
                              marginTop: 6,
                            }}
                          >
                            {h.description}
                          </div>
                        )}
                      </div>
                    </Space>
                  </Card>
                )
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
