import { useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { GraduationCap } from 'lucide-react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { SP, SproutPageHeader, SproutCard, SproutEmpty } from '../components/sprout'
import { useDataStore } from '../store/dataStore'
import { termsApi, type TermDto } from '../api/termsApi'
import { http } from '../api'

const { Text } = Typography

type GradeType =
  | 'CLASSWORK'
  | 'HOMEWORK'
  | 'CONTROL'
  | 'EXAM'
  | 'PROJECT'
  | 'OTHER'

interface SubjectDto {
  id: string
  name: string
  color: string
}

interface GradeDto {
  id: string
  studentId: string
  subjectId: string
  value: number
  type: GradeType
  date: string
  comment: string | null
  authorId: string
  subject?: { id: string; name: string; color: string }
  student?: { id: string; firstName: string; lastName: string }
  author?: { id: string; fullName: string }
}

const TYPE_LABELS: Record<GradeType, string> = {
  CLASSWORK: 'Урок',
  HOMEWORK: 'ДЗ',
  CONTROL: 'Контр.',
  EXAM: 'Экзамен',
  PROJECT: 'Проект',
  OTHER: 'Другое',
}

function gradeColor(v: number): string {
  if (v >= 9) return SP.primaryDeep
  if (v >= 7) return SP.primary
  if (v >= 5) return SP.yellowDeep
  if (v >= 4) return SP.yellowDeep
  return SP.danger
}

export default function GradesPage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)

  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [grades, setGrades] = useState<GradeDto[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Учебные периоды (четверти). Если выбран — фильтруем по его диапазону,
  // иначе по выбранному месяцу.
  const [terms, setTerms] = useState<TermDto[]>([])
  const [activeTermId, setActiveTermId] = useState<string | null>(null)

  // Modal
  const [editing, setEditing] = useState<{
    studentId: string
    studentName: string
  } | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // Загружаем предметы
  useEffect(() => {
    http
      .get<SubjectDto[]>('/v1/subjects')
      .then((r) => {
        setSubjects(r.data)
        if (r.data.length && !activeSubjectId) setActiveSubjectId(r.data[0].id)
      })
      .catch((e) =>
        message.error(e?.response?.data?.message || 'Не удалось загрузить предметы'),
      )
    // грузим четверти; если сегодня попадает в одну — выбираем её по умолчанию
    termsApi
      .list()
      .then(async (list) => {
        setTerms(list)
        try {
          const cur = await termsApi.current()
          if (cur) setActiveTermId(cur.id)
        } catch {
          /* нет текущей — оставляем месяц */
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Диапазон дат: либо четверть, либо месяц
  const range = useMemo(() => {
    const term = terms.find((t) => t.id === activeTermId)
    if (term) {
      return {
        from: dayjs(term.startDate).format('YYYY-MM-DD'),
        to: dayjs(term.endDate).format('YYYY-MM-DD'),
      }
    }
    return {
      from: dayjs(month + '-01').format('YYYY-MM-DD'),
      to: dayjs(month + '-01').endOf('month').format('YYYY-MM-DD'),
    }
  }, [terms, activeTermId, month])

  // Загружаем оценки
  const loadGrades = async () => {
    if (!activeSubjectId) return
    setLoading(true)
    try {
      const r = await http.get<GradeDto[]>('/v1/grades', {
        params: { subjectId: activeSubjectId, from: range.from, to: range.to },
      })
      setGrades(r.data)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось загрузить оценки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGrades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubjectId, range.from, range.to])

  const visibleChildren = useMemo(() => {
    let list = children
    if (activeGroupId) list = list.filter((c) => c.groupId === activeGroupId)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        (c.firstName + ' ' + c.lastName).toLowerCase().includes(q),
      )
    }
    return list
  }, [children, activeGroupId, search])

  const gradesByStudent = useMemo(() => {
    const map: Record<string, GradeDto[]> = {}
    for (const g of grades) {
      ;(map[g.studentId] ||= []).push(g)
    }
    return map
  }, [grades])

  // Среднее по ученику для активного предмета
  const avgByStudent = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [sid, list] of Object.entries(gradesByStudent)) {
      const sum = list.reduce((s, g) => s + g.value, 0)
      map[sid] = list.length ? Number((sum / list.length).toFixed(2)) : 0
    }
    return map
  }, [gradesByStudent])

  const openAdd = (studentId: string, studentName: string) => {
    setEditing({ studentId, studentName })
    form.resetFields()
    form.setFieldsValue({
      type: 'CLASSWORK',
      date: dayjs(),
      value: 5,
    })
  }

  const submit = async () => {
    if (!editing || !activeSubjectId) return
    try {
      const v = await form.validateFields()
      setSaving(true)
      await http.post('/v1/grades', {
        studentId: editing.studentId,
        subjectId: activeSubjectId,
        value: Number(v.value),
        type: v.type,
        date: dayjs(v.date).format('YYYY-MM-DD'),
        comment: v.comment || undefined,
      })
      message.success('Оценка поставлена')
      setEditing(null)
      await loadGrades()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const removeGrade = async (g: GradeDto) => {
    try {
      await http.delete(`/v1/grades/${g.id}`)
      message.success('Удалено')
      await loadGrades()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка')
    }
  }

  const activeSubject = subjects.find((s) => s.id === activeSubjectId)

  return (
    <div>
      <SproutPageHeader
        title="Журнал оценок"
        icon={<GraduationCap size={22} strokeWidth={2} />}
        iconAccent="mint"
        description="Оценки учеников по предметам за четверть или месяц"
        actions={
          <Space wrap>
            {terms.length > 0 && (
              <Select
                style={{ minWidth: 160 }}
                placeholder="Период"
                allowClear
                value={activeTermId ?? undefined}
                onChange={(v) => setActiveTermId(v ?? null)}
                options={terms.map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
            <DatePicker
              picker="month"
              value={dayjs(month + '-01')}
              onChange={(d) => {
                if (d) {
                  setMonth(d.format('YYYY-MM'))
                  setActiveTermId(null) // выбор месяца сбрасывает четверть
                }
              }}
              allowClear={false}
              disabled={!!activeTermId}
            />
          </Space>
        }
      />

      {subjects.length === 0 ? (
        <SproutCard>
          <SproutEmpty
            icon={<GraduationCap size={32} strokeWidth={1.8} />}
            title="Предметов пока нет"
            description="Сначала создайте предметы в разделе «Предметы»"
            minHeight={200}
          />
        </SproutCard>
      ) : (
        <>
          {/* Фильтры */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="glass" bordered={false} style={{ marginBottom: 12 }}>
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} md={8}>
                  <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700, marginBottom: 4 }}>
                    ПРЕДМЕТ
                  </div>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                    placeholder="Выберите предмет"
                    value={activeSubjectId ?? subjects[0]?.id}
                    onChange={(v) => setActiveSubjectId(String(v))}
                    options={subjects.map((s) => ({
                      value: s.id,
                      label: s.name,
                    }))}
                    optionRender={(opt) => {
                      const s = subjects.find((x) => x.id === opt.value)
                      return (
                        <Space size={6}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 9,
                              height: 9,
                              borderRadius: 4,
                              background: s?.color ?? SP.muted,
                            }}
                          />
                          {s?.name}
                        </Space>
                      )
                    }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700, marginBottom: 4 }}>
                    КЛАСС
                  </div>
                  <Select
                    allowClear
                    placeholder="Все классы"
                    style={{ width: '100%' }}
                    value={activeGroupId ?? undefined}
                    onChange={(v) => setActiveGroupId(v ?? null)}
                    options={groups.map((g) => ({ value: g.id, label: g.name }))}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700, marginBottom: 4 }}>
                    ПОИСК
                  </div>
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Имя ученика"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                  />
                </Col>
              </Row>
            </Card>
          </motion.div>

          {/* Список учеников и их оценок */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <Card className="glass" bordered={false}>
              {visibleChildren.length === 0 ? (
                <Empty
                  description="Учеников не найдено"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visibleChildren.map((c) => {
                    const fullName = `${c.firstName} ${c.lastName}`.trim()
                    const stuGrades = gradesByStudent[c.id] ?? []
                    const avg = avgByStudent[c.id] ?? 0
                    return (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: `1px solid ${SP.borderSoft}`,
                          background: SP.surface,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Avatar
                          size={36}
                          style={{ background: SP.primaryGhost, color: SP.primaryDeep, fontWeight: 700 }}
                        >
                          {c.firstName[0]}
                          {c.lastName[0]}
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 700, color: SP.text }}>
                            {fullName}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {groups.find((g) => g.id === c.groupId)?.name ?? '—'}
                          </Text>
                        </div>

                        {/* Средняя */}
                        <div
                          style={{
                            minWidth: 64,
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 10, color: SP.muted }}>Средняя</div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 18,
                              color: avg > 0 ? gradeColor(avg) : SP.muted,
                            }}
                          >
                            {avg > 0 ? avg.toFixed(1) : '—'}
                          </div>
                        </div>

                        {/* Оценки */}
                        <Space size={4} wrap style={{ flex: 1, minWidth: 200 }}>
                          {stuGrades.map((g) => (
                            <Popconfirm
                              key={g.id}
                              title={`Удалить ${g.value}?`}
                              description={
                                <div style={{ fontSize: 12 }}>
                                  <div>{TYPE_LABELS[g.type]} · {dayjs(g.date).format('D MMM')}</div>
                                  {g.comment && <div>«{g.comment}»</div>}
                                </div>
                              }
                              okText="Удалить"
                              cancelText="Отмена"
                              okButtonProps={{ danger: true }}
                              onConfirm={() => removeGrade(g)}
                            >
                              <Tag
                                style={{
                                  background: gradeColor(g.value),
                                  color: '#fff',
                                  border: 'none',
                                  fontWeight: 800,
                                  fontSize: 13,
                                  padding: '2px 10px',
                                  borderRadius: 12,
                                  margin: 0,
                                  cursor: 'pointer',
                                }}
                                title={`${TYPE_LABELS[g.type]} · ${dayjs(g.date).format('D MMM')}${g.comment ? ' · ' + g.comment : ''}`}
                              >
                                {g.value}
                              </Tag>
                            </Popconfirm>
                          ))}
                          {stuGrades.length === 0 && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              нет оценок
                            </Text>
                          )}
                        </Space>

                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openAdd(c.id, fullName)}
                        >
                          Оценка
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
              {loading && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Загружаю...
                </Text>
              )}
            </Card>
          </motion.div>
        </>
      )}

      {/* Modal */}
      <Modal
        title={
          <Space>
            <GraduationCap size={18} />
            <span>
              Оценка — {editing?.studentName} ·{' '}
              <span style={{ color: activeSubject?.color, fontWeight: 700 }}>
                {activeSubject?.name}
              </span>
            </span>
          </Space>
        }
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={submit}
        okText="Поставить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="value"
                label="Оценка"
                rules={[{ required: true, message: 'Введите оценку' }]}
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Тип"
                rules={[{ required: true }]}
              >
                <Select
                  options={Object.entries(TYPE_LABELS).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="date" label="Дата" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий (необязательно)">
            <Input.TextArea rows={2} placeholder="За что" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
