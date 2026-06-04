import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  Tooltip,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react'
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

// Отметки отсутствия в ячейке журнала (буква + цвет + подпись).
// Статусы приходят из API посещаемости в верхнем регистре.
const ABSENT_MARK: Record<string, { ch: string; color: string; label: string }> = {
  ABSENT: { ch: 'н', color: '#D2615B', label: 'Отсутствовал' },
  SICK: { ch: 'б', color: '#E5B43A', label: 'Болел' },
  VACATION: { ch: 'у', color: '#5BA9D1', label: 'Уважительная причина' },
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

  // Учебные периоды (четверти) — нужны для расчёта среднего балла «за четверть».
  const [terms, setTerms] = useState<TermDto[]>([])

  // Расписание выбранного класса: из него берём дни недели, когда идёт
  // выбранный предмет, чтобы в журнале показать ВСЕ уроки месяца (даже пустые).
  const [scheduleItems, setScheduleItems] = useState<
    { dayOfWeek: number; subjectId?: string | null }[]
  >([])

  // Посещаемость по урокам месяца: studentId → дата → статус (PRESENT/ABSENT/…).
  // Если ученик отсутствовал — в этот день нельзя поставить оценку.
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, Record<string, string>>
  >({})

  // Колонки-даты, добавленные вручную кнопкой «+ урок».
  const [extraDates, setExtraDates] = useState<string[]>([])

  // Modal
  const [editing, setEditing] = useState<{
    studentId: string
    studentName: string
    /** Предзаполненная дата при клике по ячейке журнала */
    date?: string
  } | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // Контейнер журнала — для авто-прокрутки к последним (свежим) урокам.
  const journalRef = useRef<HTMLDivElement>(null)

  // Загружаем предметы и четверти (предмет НЕ выбираем автоматически).
  useEffect(() => {
    http
      .get<SubjectDto[]>('/v1/subjects')
      .then((r) => setSubjects(r.data))
      .catch((e) =>
        message.error(e?.response?.data?.message || 'Не удалось загрузить предметы'),
      )
    termsApi.list().then(setTerms).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Расписание выбранного класса (для колонок-уроков по предмету).
  useEffect(() => {
    if (!activeGroupId) {
      setScheduleItems([])
      return
    }
    http
      .get<{ dayOfWeek: number; subjectId?: string | null }[]>('/v1/schedule', {
        params: { groupId: activeGroupId },
      })
      .then((r) => setScheduleItems(r.data || []))
      .catch(() => setScheduleItems([]))
  }, [activeGroupId])

  // Границы выбранного месяца.
  const monthStart = useMemo(() => dayjs(month + '-01'), [month])
  const monthEnd = useMemo(() => monthStart.endOf('month'), [monthStart])

  // Активная четверть = та, в диапазон которой попадает выбранный месяц.
  // Средний балл считается за всю эту четверть.
  const activeTerm = useMemo(() => {
    return (
      terms.find(
        (t) =>
          !monthStart.isBefore(dayjs(t.startDate), 'day') &&
          !monthStart.isAfter(dayjs(t.endDate), 'day'),
      ) ?? null
    )
  }, [terms, monthStart])

  // Дни недели (1..7), когда идёт выбранный предмет — по расписанию класса.
  const subjectWeekdays = useMemo(() => {
    const set = new Set<number>()
    for (const it of scheduleItems) {
      if (it.subjectId && it.subjectId === activeSubjectId) set.add(it.dayOfWeek)
    }
    return set
  }, [scheduleItems, activeSubjectId])

  // Диапазон загрузки оценок: вся четверть (для среднего балла), иначе месяц.
  const gradeRange = useMemo(() => {
    if (activeTerm) {
      return {
        from: dayjs(activeTerm.startDate).format('YYYY-MM-DD'),
        to: dayjs(activeTerm.endDate).format('YYYY-MM-DD'),
      }
    }
    return {
      from: monthStart.format('YYYY-MM-DD'),
      to: monthEnd.format('YYYY-MM-DD'),
    }
  }, [activeTerm, monthStart, monthEnd])

  // Загружаем оценки за четверть/месяц
  const loadGrades = async () => {
    if (!activeSubjectId) return
    setLoading(true)
    try {
      const r = await http.get<GradeDto[]>('/v1/grades', {
        params: {
          subjectId: activeSubjectId,
          from: gradeRange.from,
          to: gradeRange.to,
        },
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
  }, [activeSubjectId, gradeRange.from, gradeRange.to])

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

  // Колонки журнала = ВСЕ уроки выбранного месяца по предмету:
  //  • даты по расписанию (дни недели предмета) в пределах месяца;
  //  • плюс даты, где уже есть оценки (этого месяца);
  //  • плюс вручную добавленные уроки (кнопка «+ урок»).
  const inMonth = (d: dayjs.Dayjs) =>
    !d.isBefore(monthStart, 'day') && !d.isAfter(monthEnd, 'day')

  const dateColumns = useMemo(() => {
    const set = new Set<string>()
    // По расписанию — перебираем все дни месяца.
    if (subjectWeekdays.size) {
      let d = monthStart
      while (!d.isAfter(monthEnd, 'day')) {
        const dow = d.day() === 0 ? 7 : d.day() // dayjs: 0=вс → 7
        if (subjectWeekdays.has(dow)) set.add(d.format('YYYY-MM-DD'))
        d = d.add(1, 'day')
      }
    }
    // Даты уже выставленных оценок в этом месяце.
    for (const g of grades) {
      const gd = dayjs(g.date)
      if (inMonth(gd)) set.add(gd.format('YYYY-MM-DD'))
    }
    // Вручную добавленные уроки этого месяца.
    for (const d of extraDates) {
      const dd = dayjs(d)
      if (inMonth(dd)) set.add(d)
    }
    return Array.from(set).sort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectWeekdays, grades, extraDates, monthStart, monthEnd])

  // Оценки в разрезе «ученик → дата → список оценок» (в ячейке может быть
  // несколько оценок за один день).
  const gradesByStudentDate = useMemo(() => {
    const map: Record<string, Record<string, GradeDto[]>> = {}
    for (const g of grades) {
      const d = dayjs(g.date).format('YYYY-MM-DD')
      ;((map[g.studentId] ||= {})[d] ||= []).push(g)
    }
    return map
  }, [grades])

  // Посещаемость по датам-урокам выбранного месяца (для блокировки оценки
  // отсутствующим). Грузим параллельно по каждой дате выбранного класса.
  const colsKey = dateColumns.join('|')
  useEffect(() => {
    if (!activeGroupId || dateColumns.length === 0) {
      setAttendanceMap({})
      return
    }
    let cancelled = false
    Promise.all(
      dateColumns.map((d) =>
        http
          .get<{ studentId: string; status: string }[]>('/v1/attendance', {
            params: { date: d, groupId: activeGroupId },
          })
          .then((r) => ({ date: d, rows: r.data || [] }))
          .catch(() => ({ date: d, rows: [] as { studentId: string; status: string }[] })),
      ),
    ).then((results) => {
      if (cancelled) return
      const map: Record<string, Record<string, string>> = {}
      for (const { date, rows } of results) {
        for (const row of rows) {
          ;(map[row.studentId] ||= {})[date] = row.status
        }
      }
      setAttendanceMap(map)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, colsKey])

  // Статус отсутствия ученика в дату (любой статус кроме PRESENT) — иначе null.
  const absentStatusOf = (studentId: string, date: string): string | null => {
    const s = attendanceMap[studentId]?.[date]
    return s && s !== 'PRESENT' ? s : null
  }

  // Добавить пустую колонку-урок на выбранную дату.
  const addLessonDate = (d: string) => {
    setExtraDates((prev) => (prev.includes(d) ? prev : [...prev, d]))
  }

  // Авто-прокрутка журнала к последним урокам (вправо), когда появились
  // колонки — чтобы сразу были видны самые свежие оценки.
  useLayoutEffect(() => {
    const el = journalRef.current
    if (el && dateColumns.length > 0) {
      el.scrollLeft = el.scrollWidth
    }
  }, [dateColumns.length, activeSubjectId, activeGroupId])

  const openAdd = (studentId: string, studentName: string, date?: string) => {
    setEditing({ studentId, studentName, date })
    form.resetFields()
    form.setFieldsValue({
      type: 'CLASSWORK',
      date: date ? dayjs(date) : dayjs(),
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
        description="Все уроки месяца по предмету · средний балл за четверть"
        actions={
          <Space wrap>
            {activeTerm && (
              <Tooltip title="Средний балл считается за эту четверть">
                <Tag
                  color="green"
                  style={{ borderRadius: 8, fontWeight: 700, margin: 0 }}
                >
                  {activeTerm.name}
                </Tag>
              </Tooltip>
            )}
            <Button
              icon={<ChevronLeft size={16} />}
              onClick={() =>
                setMonth(monthStart.subtract(1, 'month').format('YYYY-MM'))
              }
              title="Предыдущий месяц"
            />
            <DatePicker
              picker="month"
              value={monthStart}
              onChange={(d) => d && setMonth(d.format('YYYY-MM'))}
              allowClear={false}
              format="MMMM YYYY"
              style={{ minWidth: 150 }}
            />
            <Button
              icon={<ChevronRight size={16} />}
              onClick={() =>
                setMonth(monthStart.add(1, 'month').format('YYYY-MM'))
              }
              title="Следующий месяц"
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
                    КЛАСС <span style={{ color: SP.danger }}>*</span>
                  </div>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                    placeholder="Выберите класс"
                    value={activeGroupId ?? undefined}
                    onChange={(v) => setActiveGroupId(v ?? null)}
                    options={groups.map((g) => ({ value: g.id, label: g.name }))}
                    status={!activeGroupId ? 'warning' : undefined}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ fontSize: 11, color: SP.muted, fontWeight: 700, marginBottom: 4 }}>
                    ПРЕДМЕТ <span style={{ color: SP.danger }}>*</span>
                  </div>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                    placeholder="Выберите предмет"
                    value={activeSubjectId ?? undefined}
                    onChange={(v) => setActiveSubjectId(String(v))}
                    status={!activeSubjectId ? 'warning' : undefined}
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
                    ПОИСК
                  </div>
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Имя ученика"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    disabled={!activeGroupId || !activeSubjectId}
                  />
                </Col>
              </Row>
            </Card>
          </motion.div>

          {/* Классический журнал: ученики в строках, даты уроков в колонках */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <Card className="glass" bordered={false} styles={{ body: { padding: 12 } }}>
              {!activeGroupId || !activeSubjectId ? (
                <SproutEmpty
                  icon={<GraduationCap size={32} strokeWidth={1.8} />}
                  title="Выберите класс и предмет"
                  description={
                    !activeGroupId && !activeSubjectId
                      ? 'Сверху выберите класс и предмет — журнал откроется автоматически'
                      : !activeGroupId
                        ? 'Осталось выбрать класс'
                        : 'Осталось выбрать предмет'
                  }
                  minHeight={220}
                />
              ) : (
                <>
              {/* Тулбар журнала: предмет + добавление колонки-урока */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                <Space size={8} wrap>
                  {activeSubject && (
                    <Tag
                      style={{
                        background: activeSubject.color + '22',
                        color: activeSubject.color,
                        border: 'none',
                        fontWeight: 700,
                        borderRadius: 8,
                      }}
                    >
                      {activeSubject.name}
                    </Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {visibleChildren.length} уч. · {dateColumns.length} уроков
                  </Text>
                </Space>
                <DatePicker
                  size="small"
                  placeholder="+ урок (дата)"
                  format="DD.MM.YYYY"
                  value={null}
                  suffixIcon={<PlusOutlined />}
                  onChange={(d: dayjs.Dayjs | null) =>
                    d && addLessonDate(d.format('YYYY-MM-DD'))
                  }
                />
              </div>

              {visibleChildren.length === 0 ? (
                <Empty
                  description="Учеников не найдено"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div className="gj-wrap" ref={journalRef}>
                  <table className="gj">
                    <thead>
                      <tr>
                        <th className="gj-name gj-th">Ученик</th>
                        {dateColumns.map((d) => (
                          <th key={d} className="gj-date gj-th" title={dayjs(d).format('dddd, D MMMM YYYY')}>
                            <span className="gj-date-d">{dayjs(d).format('DD')}</span>
                            <span className="gj-date-m">{dayjs(d).format('MMM')}</span>
                            <span className="gj-date-w">{dayjs(d).format('dd')}</span>
                          </th>
                        ))}
                        {dateColumns.length === 0 && (
                          <th className="gj-th" style={{ minWidth: 220, fontWeight: 500 }}>
                            Уроков нет — добавьте дату справа сверху или кликните «+»
                          </th>
                        )}
                        <th
                          className="gj-avg gj-th"
                          title="Средний балл за четверть"
                        >
                          Сред.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleChildren.map((c, i) => {
                        const fullName = `${c.firstName} ${c.lastName}`.trim()
                        const avg = avgByStudent[c.id] ?? 0
                        const byDate = gradesByStudentDate[c.id] ?? {}
                        const cols =
                          dateColumns.length > 0 ? dateColumns : ['__none__']
                        return (
                          <tr key={c.id}>
                            <td className="gj-name">
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                }}
                              >
                                <span className="gj-idx">{i + 1}</span>
                                <Avatar
                                  size={28}
                                  style={{
                                    background: SP.primaryGhost,
                                    color: SP.primaryDeep,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    flexShrink: 0,
                                  }}
                                >
                                  {c.firstName[0]}
                                  {c.lastName[0]}
                                </Avatar>
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: SP.text,
                                      fontSize: 13,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {fullName}
                                  </div>
                                  <div style={{ fontSize: 11, color: SP.muted }}>
                                    {groups.find((g) => g.id === c.groupId)?.name ?? '—'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {cols.map((d) => {
                              if (d === '__none__') {
                                return (
                                  <td
                                    key={d}
                                    className="gj-cell"
                                    onClick={() => openAdd(c.id, fullName)}
                                  >
                                    <span className="gj-add">+</span>
                                  </td>
                                )
                              }
                              const cell = byDate[d] ?? []
                              // Отметка отсутствия — только если оценки ещё нет.
                              const absent =
                                cell.length === 0 ? absentStatusOf(c.id, d) : null
                              const mark = absent
                                ? ABSENT_MARK[absent] ?? ABSENT_MARK.ABSENT
                                : null
                              return (
                                <td
                                  key={d}
                                  className="gj-cell"
                                  style={mark ? { cursor: 'not-allowed' } : undefined}
                                  onClick={() => {
                                    if (mark) return // отсутствовал — оценку нельзя
                                    openAdd(c.id, fullName, d)
                                  }}
                                >
                                  {cell.length > 0 ? (
                                    <div className="gj-cell-grades">
                                      {cell.map((g) => (
                                        <span
                                          key={g.id}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Popconfirm
                                            title={`Удалить оценку ${g.value}?`}
                                            description={
                                              <div style={{ fontSize: 12 }}>
                                                <div>
                                                  {TYPE_LABELS[g.type]} ·{' '}
                                                  {dayjs(g.date).format('D MMM')}
                                                </div>
                                                {g.comment && <div>«{g.comment}»</div>}
                                              </div>
                                            }
                                            okText="Удалить"
                                            cancelText="Отмена"
                                            okButtonProps={{ danger: true }}
                                            onConfirm={() => removeGrade(g)}
                                          >
                                            <span
                                              className="gj-grade"
                                              style={{ background: gradeColor(g.value) }}
                                              title={`${TYPE_LABELS[g.type]} · ${dayjs(g.date).format('D MMM')}${g.comment ? ' · ' + g.comment : ''}`}
                                            >
                                              {g.value}
                                            </span>
                                          </Popconfirm>
                                        </span>
                                      ))}
                                    </div>
                                  ) : mark ? (
                                    <span
                                      className="gj-absent"
                                      style={{ color: mark.color }}
                                      title={`${mark.label} — оценку поставить нельзя`}
                                    >
                                      {mark.ch}
                                    </span>
                                  ) : (
                                    <span className="gj-add">+</span>
                                  )}
                                </td>
                              )
                            })}

                            <td
                              className="gj-avg"
                              style={{ color: avg > 0 ? gradeColor(avg) : SP.muted }}
                            >
                              {avg > 0 ? avg.toFixed(1) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {loading && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Загружаю...
                </Text>
              )}
                </>
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
