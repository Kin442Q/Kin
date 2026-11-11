import { uiLanguage, uiText } from '../i18n/uiText'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Collapse, Spin, Tag, App as AntdApp } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'

import { Calendar } from 'lucide-react'
import { SP, SproutPageHeader, SproutEmpty } from '../components/sprout'
import WeekSchedule from '../components/WeekSchedule'
import ScheduleBulkModal from '../components/ScheduleBulkModal'
import { useDataStore } from '../store/dataStore'
import { useLabels } from '../hooks/useLabels'
import { http } from '../api'
import { compareClassNames, groupByGrade } from '../lib/classes'
import { lessonsByGroup, type WeekLesson } from '../lib/scheduleWeek'
import type { TeacherOption } from '../lib/scheduleBulk'

interface ScheduleApi extends WeekLesson {
  subjectId?: string | null
}

interface SubjectDto {
  id: string
  name: string
  color: string
}

interface StaffDto {
  id: string
  firstName: string
  lastName: string
  /** Учётная запись для входа: именно её id хранится в уроках (его видит мобильное приложение) */
  user?: { id: string } | null
}

/** Учитель из раздела «Доступ учителей» (id — учётной записи). */
interface TeacherDto {
  id: string
  fullName: string
  isActive: boolean
  groupId: string | null
  teachingGroups?: { id: string }[]
  teachingSubjects?: { id: string }[]
}

const lessonsWord = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? uiText("урок") : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? uiText("урока") : uiText("уроков")

/**
 * Расписание уроков, сгруппированное по классам: сверху выбор класса (или «Все классы» — тогда
 * у каждого класса своя раскрывающаяся неделя), внутри неделя по дням. Уроки добавляются пачкой.
 */
export default function SchedulePage() {
  const { message } = AntdApp.useApp()
  const groups = useDataStore((s) => s.groups)
  const L = useLabels()
  const isSchool = L.isSchool

  const [items, setItems] = useState<ScheduleApi[]>([])
  const [loading, setLoading] = useState(false)

  const [groupId, setGroupId] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [bulkDays, setBulkDays] = useState<number[]>([])
  const [bulkGroup, setBulkGroup] = useState<string | undefined>(undefined)
  const [openKeys, setOpenKeys] = useState<string[] | null>(null)

  // Школьные справочники
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([])
  // Имена по id: учётных записей (новые уроки) и сотрудников (старые уроки, внесённые раньше)
  const [nameById, setNameById] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!isSchool) return
    http
      .get<SubjectDto[]>('/v1/subjects')
      .then((r) => setSubjects(r.data))
      .catch(() => {})
    // Учителя с доступом (id учётной записи) — их и выбираем в уроке; сотрудники нужны только для имён
    const names = new Map<string, string>()
    Promise.all([
      http.get<TeacherDto[]>('/v1/teachers').then((r) => r.data).catch(() => [] as TeacherDto[]),
      http.get<StaffDto[]>('/v1/staff').then((r) => r.data).catch(() => [] as StaffDto[]),
    ]).then(([users, staff]) => {
      for (const st of staff) {
        const full = `${st.lastName} ${st.firstName}`.trim()
        names.set(st.id, full)
        if (st.user?.id) names.set(st.user.id, full)
      }
      for (const u of users) names.set(u.id, u.fullName)
      setNameById(names)
      const fromUsers: TeacherOption[] = users
        .filter((u) => u.isActive)
        .map((u) => ({
          id: u.id,
          name: u.fullName,
          groupIds: [...(u.teachingGroups ?? []).map((g) => g.id), ...(u.groupId ? [u.groupId] : [])],
          subjectIds: (u.teachingSubjects ?? []).map((x) => x.id),
        }))
      // Роль учителя не видит «Доступ учителей»: тогда берём сотрудников с учётной записью
      setTeacherOptions(
        fromUsers.length
          ? fromUsers
          : staff
              .filter((st) => st.user?.id)
              .map((st) => ({ id: st.user!.id, name: `${st.lastName} ${st.firstName}`.trim() })),
      )
    })
  }, [isSchool])

  const load = async () => {
    try {
      setLoading(true)
      // Берём расписание всех классов: окно «Добавить уроки» подсказывает, что уже внесено
      const res = await http.get<ScheduleApi[]>('/v1/schedule')
      setItems(res.data || [])
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || uiText("Не удалось загрузить расписание"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remove = async (id: string) => {
    try {
      await http.delete(`/v1/schedule/${id}`)
      message.success(uiText("Удалено"))
      await load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || uiText("Не удалось удалить"))
    }
  }

  const orderedGroups = useMemo(() => [...groups].sort((a, b) => compareClassNames(a.name, b.name)), [groups, uiLanguage()])
  const byGroup = useMemo(() => lessonsByGroup(items), [items, uiLanguage()])
  const grades = useMemo(() => groupByGrade(groups, (g) => g.name), [groups, uiLanguage()])

  // Первый класс с уроками раскрыт сразу, остальные свёрнуты: так экран не превращается в длинную ленту
  useEffect(() => {
    if (openKeys !== null || orderedGroups.length === 0 || loading) return
    const first = orderedGroups.find((g) => (byGroup.get(g.id)?.length ?? 0) > 0) ?? orderedGroups[0]
    setOpenKeys([first.id])
  }, [orderedGroups, byGroup, loading, openKeys])

  const teacherName = (id: string) => nameById.get(id)

  const openBulk = (days: number[], forGroup?: string) => {
    setBulkDays(days)
    setBulkGroup(forGroup ?? groupId)
    setOpen(true)
  }

  const selected = groupId ? groups.find((g) => g.id === groupId) : undefined

  return (
    <div>
      <SproutPageHeader
        title={uiText("Расписание уроков")}
        icon={<Calendar size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={uiText("Уроки по классам: предмет, учитель, кабинет")}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openBulk([])}>
            {uiText("Добавить уроки")}
          </Button>
        }
      />

      {groups.length === 0 ? (
        <Card className="glass" bordered={false}>
          <SproutEmpty
            icon={<Calendar size={28} strokeWidth={1.8} />}
            title={uiText("Классов пока нет")}
            description={uiText("Сначала создайте класс в разделе «Классы»")}
            minHeight={180}
          />
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Выбор класса: «Все классы» или один класс. Классы собраны по параллелям. */}
          <div
            role="radiogroup"
            aria-label={uiText("Класс")}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 18px', marginBottom: 16 }}
          >
            <button
              type="button"
              role="radio"
              aria-checked={!groupId}
              className={`cf-chip${!groupId ? ' is-on' : ''}`}
              onClick={() => setGroupId(undefined)}
            >
              {" " + uiText("Все классы") + " "}</button>
            {grades.map((gr) => (
              <div key={String(gr.key)} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span className="sp-grade-badge">{gr.grade ?? '•'}</span>
                {gr.items.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={g.id === groupId}
                    className={`cf-chip${g.id === groupId ? ' is-on' : ''}`}
                    onClick={() => setGroupId(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <Spin spinning={loading}>
            {selected ? (
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: SP.text, marginBottom: 12 }}>
                  {selected.name}
                  <span style={{ fontSize: 13, fontWeight: 500, color: SP.muted, marginLeft: 10 }}>
                    {(byGroup.get(selected.id)?.length ?? 0)} {lessonsWord(byGroup.get(selected.id)?.length ?? 0)} {" " + uiText("в неделю") + " "}</span>
                </div>
                <WeekSchedule
                  lessons={byGroup.get(selected.id) ?? []}
                  teacherName={isSchool ? teacherName : undefined}
                  onRemove={remove}
                  onAddDay={(d) => openBulk([d], selected.id)}
                />
              </div>
            ) : (
              <Collapse
                bordered={false}
                style={{ background: 'transparent' }}
                activeKey={openKeys ?? []}
                onChange={(keys) => setOpenKeys(Array.isArray(keys) ? keys : [keys])}
                items={orderedGroups.map((g) => {
                  const list = byGroup.get(g.id) ?? []
                  return {
                    key: g.id,
                    style: { marginBottom: 12, border: `1px solid ${SP.borderSoft}`, borderRadius: 16, background: SP.surface },
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <b style={{ fontSize: 16, color: SP.text }}>{g.name}</b>
                        <Tag color={list.length ? 'blue' : undefined} style={{ margin: 0 }}>
                          {list.length ? uiText("{0} {1} в неделю", list.length, lessonsWord(list.length)) : uiText("уроков нет")}
                        </Tag>
                      </span>
                    ),
                    extra: (
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          openBulk([], g.id)
                        }}
                      >
                        {" " + uiText("Добавить уроки") + " "}</Button>
                    ),
                    children: (
                      <WeekSchedule
                        lessons={list}
                        teacherName={isSchool ? teacherName : undefined}
                        onRemove={remove}
                        onAddDay={(d) => openBulk([d], g.id)}
                      />
                    ),
                  }
                })}
              />
            )}
          </Spin>
        </motion.div>
      )}

      <ScheduleBulkModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={load}
        groups={groups}
        subjects={subjects}
        teachers={teacherOptions}
        isSchool={isSchool}
        existing={items}
        defaultGroupId={bulkGroup}
        defaultDays={bulkDays}
      />
    </div>
  )
}
