import { useEffect, useMemo, useState } from 'react'
import { Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

import { SP, SproutCard, SproutEmpty } from '../../components/sprout'
import StudentHomeworkCard from '../../components/student/StudentHomeworkCard'
import { useAuthStore } from '../../store/authStore'
import { useFeature } from '../../hooks/useFeature'
import {
  studentApi,
  type StudentGrade,
  type StudentHomework,
  type StudentLesson,
  type StudentProfile,
  type SubmissionStatus,
} from '../../api/schoolApi'

const gradeColor = (v: number) => (v >= 9 ? 'green' : v >= 7 ? 'cyan' : v >= 5 ? 'orange' : 'red')

/** Главная ученика: сегодняшние уроки, ближайшие задания и последние оценки. */
export default function StudentHomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const withHomework = useFeature('homework')
  const withGrades = useFeature('grades')
  const withSchedule = useFeature('schedule')

  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [homework, setHomework] = useState<StudentHomework[]>([])
  const [grades, setGrades] = useState<StudentGrade[]>([])
  const [lessons, setLessons] = useState<StudentLesson[]>([])

  useEffect(() => {
    studentApi.me().then(setProfile).catch(() => {})
    if (withHomework) studentApi.homework().then(setHomework).catch(() => {})
    if (withGrades) studentApi.grades().then((g) => setGrades(g.items.slice(0, 6))).catch(() => {})
    if (withSchedule) studentApi.schedule().then(setLessons).catch(() => {})
  }, [withHomework, withGrades, withSchedule])

  const todayLessons = useMemo(() => {
    const dow = ((dayjs().day() + 6) % 7) + 1 // Пн=1 … Вс=7
    return lessons.filter((l) => l.dayOfWeek === dow)
  }, [lessons])

  const upcoming = useMemo(() => {
    const today = dayjs().startOf('day')
    return homework
      .filter((h) => {
        const st = h.submission?.status
        const checked = st === 'DONE' || st === 'PARTIAL' || st === 'NOT_DONE'
        return !checked && !dayjs(h.dueDate).isBefore(today)
      })
      .slice(0, 5)
  }, [homework])

  const apply = (id: string, status: SubmissionStatus | null) =>
    setHomework((list) =>
      list.map((h) =>
        h.id === id
          ? { ...h, submission: status ? { status, comment: null, updatedAt: new Date().toISOString() } : null }
          : h,
      ),
    )

  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div>
      <SproutCard accent="mint-yellow" padding={18} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: SP.text }}>
          {greeting}, {profile?.firstName ?? user?.fullName?.split(' ')[0] ?? 'ученик'}!
        </div>
        <div style={{ fontSize: 13, color: SP.textMid, marginTop: 2 }}>
          {dayjs().format('dddd, D MMMM')}
          {profile && ` · ${profile.group.name} класс`}
          {profile?.homeroomTeacher && ` · классный руководитель: ${profile.homeroomTeacher.fullName}`}
        </div>
      </SproutCard>

      {withSchedule && (
        <SproutCard style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Уроки сегодня</div>
          {todayLessons.length === 0 ? (
            <SproutEmpty title="Сегодня уроков нет" minHeight={90} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayLessons.map((l) => (
                <div key={l.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ width: 96, color: SP.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {l.startTime}–{l.endTime}
                  </span>
                  <Tag
                    style={{
                      background: l.subject?.color ?? SP.primary,
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                    }}
                  >
                    {l.subject?.name ?? l.activity}
                  </Tag>
                  {l.room && <span style={{ color: SP.muted, fontSize: 12 }}>каб. {l.room}</span>}
                </div>
              ))}
            </div>
          )}
        </SproutCard>
      )}

      {withHomework && (
        <SproutCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Что нужно сделать</div>
            <a onClick={() => navigate('/student/homework')} style={{ cursor: 'pointer', fontSize: 13 }}>
              Все задания →
            </a>
          </div>
          {upcoming.length === 0 ? (
            <SproutEmpty title="Заданий нет — отдыхайте!" minHeight={90} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcoming.map((h) => (
                <StudentHomeworkCard key={h.id} hw={h} onChange={apply} />
              ))}
            </div>
          )}
        </SproutCard>
      )}

      {withGrades && (
        <SproutCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Последние оценки</div>
            <a onClick={() => navigate('/student/grades')} style={{ cursor: 'pointer', fontSize: 13 }}>
              Все оценки →
            </a>
          </div>
          {grades.length === 0 ? (
            <SproutEmpty title="Оценок пока нет" minHeight={90} />
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {grades.map((g) => (
                <div
                  key={g.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: SP.surfaceAlt,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Tag color={gradeColor(g.value)} style={{ margin: 0, fontWeight: 700 }}>
                    {g.value}
                  </Tag>
                  <span style={{ fontSize: 13 }}>{g.subject.name}</span>
                  <span style={{ fontSize: 11, color: SP.muted }}>{dayjs(g.date).format('DD.MM')}</span>
                </div>
              ))}
            </div>
          )}
        </SproutCard>
      )}
    </div>
  )
}
