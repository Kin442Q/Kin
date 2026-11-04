import { http } from './http'
import type { SubmissionStatus } from './student'

/* ============================================================
   Классный руководитель и статусы домашних заданий (сторона учителя).
   Зеркало web/src/api/schoolApi.ts.
   ============================================================ */

/** Что выставляет учитель («сделал» — SUBMITTED — отмечает только сам ученик). */
export type StaffStatus = 'DONE' | 'PARTIAL' | 'NOT_DONE'
export type NoticeTemplate = 'NOT_DONE' | 'PARTIAL' | 'REMINDER'

export interface RosterRow {
  student: {
    id: string
    firstName: string
    lastName: string
    photoUrl: string | null
    gender: 'MALE' | 'FEMALE'
  }
  status: SubmissionStatus | null
  comment: string | null
  markedAt: string | null
  parentsCount: number
}

export interface HomeworkRoster {
  homework: {
    id: string
    title: string
    description: string | null
    dueDate: string
    subject: { id: string; name: string; color: string }
    group: { id: string; name: string }
  }
  students: RosterRow[]
  summary: {
    total: number
    done: number
    partial: number
    notDone: number
    submitted: number
    unmarked: number
  }
}

export interface NotifyResult {
  notified: number
  sent: number
  skipped: Array<{ studentId: string; reason: 'NO_PARENTS' }>
}

export const homeworkStatusApi = {
  roster: (homeworkId: string) =>
    http
      .get<HomeworkRoster>(`/v1/homework/${homeworkId}/submissions`)
      .then((r) => r.data),

  /** status: null — снять отметку. comment не передан — комментарий не меняется. */
  setStatuses: (
    homeworkId: string,
    items: Array<{ studentId: string; status: StaffStatus | null; comment?: string }>,
  ) =>
    http
      .put<HomeworkRoster>(`/v1/homework/${homeworkId}/submissions`, { items })
      .then((r) => r.data),

  notifyParents: (
    homeworkId: string,
    body: { studentIds: string[]; template?: NoticeTemplate; note?: string },
  ) =>
    http
      .post<NotifyResult>(`/v1/homework/${homeworkId}/notify-parents`, body)
      .then((r) => r.data),
}

export interface HomeroomClass {
  id: string
  name: string
  homeroomTeacher: { id: string; fullName: string } | null
  studentsCount: number
}

export interface HomeroomRow {
  student: {
    id: string
    firstName: string
    lastName: string
    photoUrl: string | null
  }
  homework: {
    total: number
    done: number
    partial: number
    notDone: number
    submitted: number
    unmarked: number
  } | null
  attendance: {
    present: number
    absent: number
    sick: number
    vacation: number
  } | null
  grades: { count: number; average: number | null } | null
  parentsCount: number
}

export interface HomeroomOverview {
  group: { id: string; name: string }
  days: number
  from: string
  to: string
  /** Какие блоки включены у школы — выключенные приходят как null в строках. */
  sections: { homework: boolean; attendance: boolean; grades: boolean }
  homeworkCount: number
  students: HomeroomRow[]
}

export const homeroomApi = {
  mine: () => http.get<HomeroomClass[]>('/v1/homeroom/mine').then((r) => r.data),
  overview: (groupId: string, days = 14) =>
    http
      .get<HomeroomOverview>(`/v1/homeroom/${groupId}/overview`, {
        params: { days },
      })
      .then((r) => r.data),
  notify: (groupId: string, body: { studentIds: string[]; text: string }) =>
    http
      .post<NotifyResult>(`/v1/homeroom/${groupId}/notify`, body)
      .then((r) => r.data),
}
