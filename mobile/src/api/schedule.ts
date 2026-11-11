import { http } from './http'

/** Урок расписания (/v1/schedule): для учителя сервер отдаёт уроки его классов. */
export interface ScheduleLesson {
  id: string
  groupId: string
  dayOfWeek: number // 1..7, Пн..Вс
  startTime: string // "HH:mm"
  endTime: string
  activity: string
  room: string | null
  teacherId: string | null
  subject: { id: string; name: string; color: string } | null
}

export const scheduleApi = {
  list: (groupId?: string) =>
    http.get<ScheduleLesson[]>('/v1/schedule', { params: { groupId } }).then((r) => r.data),
}
