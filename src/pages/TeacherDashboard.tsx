import { useEffect, useMemo, useState } from 'react'
import { Button, Col, Row } from 'antd'
import { Bell, ChevronRight, ClipboardCheck, GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

import { GreetingBanner, SP, SproutCard, SproutEmpty } from '../components/sprout'
import { http } from '../api'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import { useFeature } from '../hooks/useFeature'
import WeekSchedule from '../components/WeekSchedule'
import { teacherLessons } from '../lib/scheduleWeek'
import { useT } from '../i18n'
import type { AppNotification } from '../types'

interface Lesson {
  id: string
  groupId: string
  dayOfWeek: number // 1..7, Пн..Вс
  startTime: string // «HH:mm»
  endTime: string
  activity: string
  room?: string | null
  teacherId?: string | null
  subject?: { id: string; name: string; color: string } | null
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Кабинет учителя — информационная главная: какие уроки сегодня, в каких классах,
 * оповещения и мой класс. Учёта рабочего времени здесь нет.
 */
export default function TeacherDashboard() {
  const t = useT()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const showSchedule = useFeature('schedule')
  const showAttendance = useFeature('attendance')
  const showGrades = useFeature('grades')
  const showHomeroom = useFeature('homeroom')

  const [lessons, setLessons] = useState<Lesson[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  // Оповещения пользователя (сервер отдаёт последние 50)
  useEffect(() => {
    let cancelled = false
    http
      .get<AppNotification[]>('/v1/notifications')
      .then((r) => {
        if (!cancelled) setNotifications(Array.isArray(r.data) ? r.data : [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const markAllRead = () => {
    http
      .post('/v1/notifications/read-all', {})
      .then(() => setNotifications((list) => list.map((n) => ({ ...n, read: true }))))
      .catch(() => {})
  }

  useEffect(() => {
    if (!showSchedule) {
      setLoading(false)
      return
    }
    let cancelled = false
    http
      .get<Lesson[]>('/v1/schedule')
      .then((r) => {
        if (!cancelled) setLessons(Array.isArray(r.data) ? r.data : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showSchedule])

  // «Сейчас» для подсветки текущего урока
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])

  // Мои уроки на неделю: если уроки закреплены за учителями — только мои, иначе все уроки моих классов.
  const myWeek = useMemo(() => teacherLessons(lessons, user?.id), [lessons, user?.id])

  // Уроки на сегодня — из той же недели
  const todayLessons = useMemo(() => {
    const dow = dayjs().day() === 0 ? 7 : dayjs().day()
    return myWeek.filter((l) => l.dayOfWeek === dow).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [myWeek])

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const currentIdx = todayLessons.findIndex((l) => nowMin >= toMin(l.startTime) && nowMin < toMin(l.endTime))
  const nextIdx = todayLessons.findIndex((l) => nowMin < toMin(l.startTime))

  // Классы, где у меня сегодня уроки, и сколько уроков в каждом
  const classesToday = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of todayLessons) counts.set(l.groupId, (counts.get(l.groupId) ?? 0) + 1)
    return [...counts.entries()].map(([id, n]) => ({ id, n, group: groupById.get(id) }))
  }, [todayLessons, groupById])

  const homeroom = user?.homeroomGroups?.[0] ? groupById.get(user.homeroomGroups[0].id) ?? user.homeroomGroups[0] : null
  const homeroomStudents = homeroom ? children.filter((c) => c.groupId === homeroom.id).length : 0

  const notices = useMemo(
    () => [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [notifications],
  )

  const hour = new Date().getHours()
  const greeting =
    hour < 6
      ? t('dash.greet.night')
      : hour < 12
        ? t('dash.greet.morning')
        : hour < 18
          ? t('dash.greet.day')
          : t('dash.greet.evening')
  const parts = (user?.fullName ?? '').split(' ').filter(Boolean)
  const firstName = parts[1] ?? parts[0] ?? t('dash.friend')

  const subtitle = todayLessons.length
    ? `${t('teacher.lessonsToday', { n: todayLessons.length })} · ${t('teacher.classesCount', { n: classesToday.length })}`
    : t('teacher.noLessonsSub')

  return (
    <div>
      <GreetingBanner
        eyebrow={dayjs().format('dddd, D MMMM')}
        title={`${greeting}, ${firstName}!`}
        subtitle={subtitle}
        actions={
          <>
            {showAttendance && (
              <Button type="primary" size="large" icon={<ClipboardCheck size={18} />} onClick={() => navigate('/admin/attendance')}>
                {t('dash.markAttendance')}
              </Button>
            )}
            {showGrades && (
              <Button size="large" icon={<GraduationCap size={18} />} onClick={() => navigate('/admin/grades')}>
                {t('nav.grades')}
              </Button>
            )}
          </>
        }
      />

      {/* Неделя целиком: в каких классах и в какие дни у меня уроки */}
      {showSchedule && myWeek.length > 0 && (
        <SproutCard style={{ marginBottom: 16 }} delay={0.05}>
          <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>{t('teacher.weekTitle')}</div>
          <div style={{ fontSize: 12, color: SP.muted, marginBottom: 12 }}>{t('teacher.weekSub')}</div>
          <WeekSchedule
            lessons={myWeek}
            groupName={(id) => groupById.get(id)?.name}
            emptyDayText={t('teacher.weekDayEmpty')}
            todayText={t('teacher.weekToday')}
          />
        </SproutCard>
      )}

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={15} style={{ display: 'flex' }}>
          <SproutCard style={{ width: '100%' }} delay={0.1}>
            <div style={{ fontSize: 15, fontWeight: 700, color: SP.text, marginBottom: 12 }}>{t('teacher.lessonsTitle')}</div>
            {todayLessons.length === 0 ? (
              <SproutEmpty
                title={t('teacher.noLessons')}
                description={loading ? undefined : t('teacher.noLessonsHint')}
                minHeight={180}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todayLessons.map((l, i) => {
                  const done = nowMin >= toMin(l.endTime)
                  const current = i === currentIdx
                  const upcoming = currentIdx < 0 && i === nextIdx
                  const group = groupById.get(l.groupId)
                  const color = l.subject?.color ?? group?.color ?? SP.primary
                  return (
                    <div
                      key={l.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: current ? SP.primaryGhost : SP.surfaceAlt,
                        border: current ? `1px solid ${SP.primary}` : `1px solid ${SP.borderSoft}`,
                        opacity: done ? 0.55 : 1,
                      }}
                    >
                      <div style={{ width: 92, flex: 'none' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: current ? SP.primaryDeep : SP.text }}>{l.startTime}</div>
                        <div style={{ fontSize: 12, color: SP.muted }}>{l.endTime}</div>
                      </div>
                      <span style={{ width: 4, height: 38, borderRadius: 4, background: color, flex: 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: SP.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.subject?.name ?? l.activity}
                        </div>
                        <div style={{ fontSize: 12.5, color: SP.textMid }}>
                          {group?.name ?? ''}
                          {l.room ? `${group ? ' · ' : ''}${t('teacher.room', { room: l.room })}` : ''}
                        </div>
                      </div>
                      {(current || upcoming || done) && (
                        <span
                          className="sp-chip"
                          style={{
                            background: current ? SP.rose : upcoming ? SP.primarySoft : 'transparent',
                            color: current ? SP.text : upcoming ? SP.primaryDeep : SP.muted,
                            padding: '3px 10px',
                            fontWeight: 700,
                          }}
                        >
                          {current ? t('teacher.now') : upcoming ? t('teacher.next') : t('teacher.done')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </SproutCard>
        </Col>

        <Col xs={24} lg={9} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SproutCard padding={18} delay={0.15}>
            <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>{t('teacher.classesTitle')}</div>
            <div style={{ fontSize: 12, color: SP.muted, marginBottom: 12 }}>{t('teacher.classesSub')}</div>
            {classesToday.length === 0 ? (
              <div style={{ fontSize: 13, color: SP.textMid }}>{t('teacher.noClasses')}</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {classesToday.map(({ id, n, group }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => group && navigate(`/admin/groups/${id}`)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 14,
                      border: `1px solid ${SP.borderSoft}`,
                      background: SP.surfaceAlt,
                      cursor: group ? 'pointer' : 'default',
                      color: SP.text,
                      fontFamily: 'inherit',
                    }}
                  >
                    <i style={{ width: 10, height: 10, borderRadius: '50%', background: group?.color ?? SP.primary }} />
                    <b style={{ fontSize: 14 }}>{group?.name ?? '—'}</b>
                    <small style={{ color: SP.muted }}>{t('teacher.lessonsInClass', { n })}</small>
                  </button>
                ))}
              </div>
            )}
          </SproutCard>

          {homeroom && (
            <SproutCard padding={18} delay={0.2}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: SP.muted }}>{t('teacher.homeroomTitle')}</div>
                  <div className="sp-num" style={{ fontSize: 24, fontWeight: 800, color: SP.text }}>{homeroom.name}</div>
                  <div style={{ fontSize: 12.5, color: SP.textMid }}>{t('teacher.students', { n: homeroomStudents })}</div>
                </div>
                {showHomeroom && (
                  <Button onClick={() => navigate('/admin/homeroom')} icon={<ChevronRight size={16} />} iconPosition="end">
                    {t('teacher.openSummary')}
                  </Button>
                )}
              </div>
            </SproutCard>
          )}

          <SproutCard padding={18} delay={0.25}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: SP.text }}>
                <Bell size={15} /> {t('teacher.noticesTitle')}
              </div>
              {notices.some((n) => !n.read) && (
                <Button size="small" type="link" onClick={markAllRead}>
                  {t('header.markAllRead')}
                </Button>
              )}
            </div>
            {notices.length === 0 ? (
              <div style={{ fontSize: 13, color: SP.textMid }}>{t('teacher.noNotices')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notices.map((n) => (
                  <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', flex: 'none', background: n.read ? SP.borderSoft : SP.rose }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: SP.text }}>{n.title}</div>
                      {n.description ? <div style={{ fontSize: 12, color: SP.textMid, lineHeight: 1.4 }}>{n.description}</div> : null}
                      <div style={{ fontSize: 11, color: SP.muted, marginTop: 2 }}>{dayjs(n.createdAt).format('DD.MM HH:mm')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SproutCard>
        </Col>
      </Row>
    </div>
  )
}
