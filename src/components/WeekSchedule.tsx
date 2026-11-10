import { uiText } from '../i18n/uiText'
import { Button, Col, Popconfirm, Row } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import { SP } from './sprout'
import { dayName, lessonsByDay, shortName, todayDow, visibleDays, type WeekLesson } from '../lib/scheduleWeek'

// Цвет дня недели для карточек расписания (мягкий фон + насыщенный акцент).
const DAY_STYLE: Record<number, { soft: string; deep: string }> = {
  1: { soft: SP.blueSoft, deep: SP.blueDeep },
  2: { soft: SP.lilacSoft, deep: SP.lilacDeep },
  3: { soft: SP.primaryGhost, deep: SP.primaryDeep },
  4: { soft: SP.yellowSoft, deep: SP.yellowDeep },
  5: { soft: SP.roseSoft, deep: SP.roseDeep },
  6: { soft: SP.cyanSoft, deep: SP.cyan },
  7: { soft: SP.pinkSoft, deep: SP.pink },
}

interface Props {
  lessons: WeekLesson[]
  /** Если задано — на уроке показывается класс (кабинет учителя: «в каком классе у меня урок»). */
  groupName?: (groupId: string) => string | undefined
  /** Если задано — на уроке показывается учитель (расписание класса). */
  teacherName?: (teacherId: string) => string | undefined
  /** Удаление урока (кнопка в строке урока); нет — расписание только для чтения. */
  onRemove?: (id: string) => void
  /** Добавить уроки в этот день («+» в шапке дня). */
  onAddDay?: (day: number) => void
  emptyDayText?: string
  todayText?: string
}

/**
 * Неделя уроков: на каждый день недели своя карточка (Пн–Сб, воскресенье — если есть уроки),
 * сегодняшний день подсвечен. Один и тот же вид для расписания класса и для недели учителя.
 */
export default function WeekSchedule({
  lessons,
  groupName,
  teacherName,
  onRemove,
  onAddDay,
  emptyDayText = uiText("Уроков нет"),
  todayText = uiText("Сегодня"),
}: Props) {
  const byDay = lessonsByDay(lessons)
  const today = todayDow()

  return (
    <Row gutter={[16, 16]} align="stretch">
      {visibleDays(byDay).map((d) => {
        const dayItems = byDay[d] ?? []
        const st = DAY_STYLE[d]
        const isToday = d === today
        return (
          <Col xs={24} sm={12} lg={8} key={d}>
            <div
              className={`sp-day-card${isToday ? ' sp-day-card--today' : ''}`}
              style={{ ['--day-accent' as any]: st.deep }}
            >
              <div className="sp-day-head" style={{ background: st.soft }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: st.deep }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: st.deep }}>{dayName(d)}</span>
                {isToday && (
                  <span className="sp-today-badge" style={{ background: st.deep }}>
                    {todayText}
                  </span>
                )}
                {onAddDay && (
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    style={{ marginLeft: 'auto', color: st.deep }}
                    aria-label={uiText("Добавить уроки: {0}", dayName(d))}
                    onClick={() => onAddDay(d)}
                  />
                )}
                <span className="sp-day-count" style={{ color: st.deep, marginLeft: onAddDay ? 0 : 'auto' }}>
                  {dayItems.length}
                </span>
              </div>

              {dayItems.length === 0 ? (
                <div className="sp-day-empty">{emptyDayText}</div>
              ) : (
                <div>
                  {dayItems.map((r, idx) => {
                    const teacher = teacherName && r.teacherId ? teacherName(r.teacherId) : undefined
                    const meta = [
                      groupName ? groupName(r.groupId) : null,
                      teacher ? shortName(teacher) : null,
                      r.room ? uiText("каб. {0}", r.room) : null,
                    ].filter(Boolean)
                    return (
                      <div
                        key={r.id}
                        className="sp-lesson"
                        style={{ borderBottom: idx < dayItems.length - 1 ? `1px solid ${SP.borderSoft}` : 'none' }}
                      >
                        <div className="sp-lesson-time" style={{ background: st.soft, color: st.deep }}>
                          <span>{r.startTime}</span>
                          <span>{r.endTime}</span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{ width: 8, height: 8, borderRadius: 4, background: r.subject?.color ?? SP.muted, flexShrink: 0 }}
                            />
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 14,
                                color: SP.text,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {r.subject?.name ?? r.activity}
                            </span>
                          </div>
                          {meta.length > 0 && (
                            <div
                              style={{
                                fontSize: 12,
                                color: SP.muted,
                                marginTop: 2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {meta.join(' · ')}
                            </div>
                          )}
                        </div>
                        {onRemove && (
                          <Popconfirm
                            title={uiText("Удалить урок?")}
                            okText={uiText("Удалить")}
                            cancelText={uiText("Отмена")}
                            okButtonProps={{ danger: true }}
                            onConfirm={() => onRemove(r.id)}
                          >
                            <Button danger size="small" type="text" icon={<DeleteOutlined />} aria-label={uiText("Удалить урок")} />
                          </Popconfirm>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Col>
        )
      })}
    </Row>
  )
}
