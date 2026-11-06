import dayjs from 'dayjs'

/** Урок в расписании: то, что отдаёт GET /v1/schedule. */
export interface WeekLesson {
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

/** Название дня недели на языке интерфейса: 1 → «Понедельник». */
export function dayName(day: number): string {
  const s = dayjs().day(day % 7).format('dddd')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Уроки учителя: если в расписании уроки закреплены за учителями — только его, иначе все уроки его классов
 * (сервер и так отдаёт учителю уроки только его классов).
 */
export function teacherLessons<T extends WeekLesson>(lessons: T[], userId: string | undefined): T[] {
  const assigned = lessons.some((l) => l.teacherId)
  return assigned ? lessons.filter((l) => l.teacherId === userId) : lessons
}

/** Уроки по дням недели, внутри дня по времени начала. */
export function lessonsByDay<T extends WeekLesson>(lessons: T[]): Record<number, T[]> {
  const map: Record<number, T[]> = {}
  for (const l of lessons) (map[l.dayOfWeek] ||= []).push(l)
  for (const k of Object.keys(map)) map[+k].sort((a, b) => a.startTime.localeCompare(b.startTime))
  return map
}

/** Пн–Сб всегда; воскресенье только если на него есть уроки. */
export function visibleDays(byDay: Record<number, unknown[]>): number[] {
  const days = [1, 2, 3, 4, 5, 6]
  if (byDay[7]?.length) days.push(7)
  return days
}

/** Сегодняшний день недели: 1 = Пн … 7 = Вс. */
export const todayDow = (): number => ((new Date().getDay() + 6) % 7) + 1

/** Уроки по классам: id класса → его уроки. */
export function lessonsByGroup<T extends WeekLesson>(lessons: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const l of lessons) {
    const list = map.get(l.groupId)
    if (list) list.push(l)
    else map.set(l.groupId, [l])
  }
  return map
}

/** «Иванова Мария Петровна» → «Иванова М.» */
export function shortName(full: string): string {
  const [last, first] = full.trim().split(/\s+/)
  return first ? `${last} ${first[0]}.` : last
}
