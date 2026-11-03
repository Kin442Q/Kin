import { http } from './http'

/* ============================================================
   Статусы ДЗ, кабинет ученика, доступ учеников, классный руководитель.
   Ответы бэкенда распаковываются интерцептором http — здесь сразу данные.
   ============================================================ */

export type SubmissionStatus = 'SUBMITTED' | 'DONE' | 'PARTIAL' | 'NOT_DONE'
/** Что выставляет учитель («сделал» от ученика — SUBMITTED — только сам ученик). */
export type StaffStatus = 'DONE' | 'PARTIAL' | 'NOT_DONE'
export type NoticeTemplate = 'NOT_DONE' | 'PARTIAL' | 'REMINDER'

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  SUBMITTED: 'Ученик отметил «сделал»',
  DONE: 'Выполнено',
  PARTIAL: 'Частично',
  NOT_DONE: 'Не выполнено',
}

export const STATUS_COLOR: Record<SubmissionStatus, string> = {
  SUBMITTED: 'blue',
  DONE: 'green',
  PARTIAL: 'orange',
  NOT_DONE: 'red',
}

// ─── Статусы ДЗ (сотрудники) ──────────────────────────────────

export interface RosterStudent {
  id: string
  firstName: string
  lastName: string
  photoUrl: string | null
  gender: 'MALE' | 'FEMALE'
}

export interface RosterRow {
  student: RosterStudent
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
    http.get<HomeworkRoster>(`/v1/homework/${homeworkId}/submissions`).then((r) => r.data),

  /** status: null — снять отметку. comment не передан — комментарий не меняется. */
  setStatuses: (
    homeworkId: string,
    items: Array<{ studentId: string; status: StaffStatus | null; comment?: string }>,
  ) =>
    http.put<HomeworkRoster>(`/v1/homework/${homeworkId}/submissions`, { items }).then((r) => r.data),

  notifyParents: (
    homeworkId: string,
    body: { studentIds: string[]; template?: NoticeTemplate; note?: string },
  ) =>
    http.post<NotifyResult>(`/v1/homework/${homeworkId}/notify-parents`, body).then((r) => r.data),
}

// ─── Кабинет ученика ──────────────────────────────────────────

export interface StudentProfile {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  photoUrl: string | null
  group: { id: string; name: string }
  homeroomTeacher: { id: string; fullName: string } | null
}

export interface StudentHomework {
  id: string
  title: string
  description: string | null
  dueDate: string
  subject: { id: string; name: string; color: string }
  submission: { status: SubmissionStatus; comment: string | null; updatedAt: string } | null
}

export interface StudentGrade {
  id: string
  value: number
  type: string
  date: string
  comment: string | null
  subject: { id: string; name: string; color: string }
}

export interface StudentGrades {
  items: StudentGrade[]
  averages: Array<{ subject: { id: string; name: string; color: string }; count: number; average: number }>
}

export interface StudentLesson {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  activity: string
  room: string | null
  subject: { id: string; name: string; color: string } | null
}

export const studentApi = {
  me: () => http.get<StudentProfile>('/v1/student/me').then((r) => r.data),
  homework: (params?: { from?: string; to?: string }) =>
    http.get<StudentHomework[]>('/v1/student/homework', { params }).then((r) => r.data),
  setSubmitted: (homeworkId: string, submitted: boolean) =>
    http
      .put<{ status: SubmissionStatus | null }>(`/v1/student/homework/${homeworkId}/submitted`, { submitted })
      .then((r) => r.data),
  grades: () => http.get<StudentGrades>('/v1/student/grades').then((r) => r.data),
  schedule: () => http.get<StudentLesson[]>('/v1/student/schedule').then((r) => r.data),
}

// ─── Доступ ученика (вход в кабинет) ──────────────────────────

export interface StudentAccount {
  id: string
  login: string
  isActive: boolean
  lastLoginAt: string | null
}

export interface IssuedAccount {
  account: StudentAccount
  /** Показывается один раз — на сервере хранится только хеш. */
  password: string
}

export const studentAccountApi = {
  get: (studentId: string) =>
    http.get<StudentAccount | null>(`/v1/students/${studentId}/account`).then((r) => r.data),
  create: (studentId: string, body: { login?: string; password?: string } = {}) =>
    http.post<IssuedAccount>(`/v1/students/${studentId}/account`, body).then((r) => r.data),
  resetPassword: (studentId: string, body: { password?: string } = {}) =>
    http
      .post<IssuedAccount>(`/v1/students/${studentId}/account/reset-password`, body)
      .then((r) => r.data),
  remove: (studentId: string) => http.delete(`/v1/students/${studentId}/account`),
}

// ─── Классный руководитель ────────────────────────────────────

export interface HomeroomClass {
  id: string
  name: string
  homeroomTeacher: { id: string; fullName: string } | null
  studentsCount: number
}

export interface HomeroomRow {
  student: { id: string; firstName: string; lastName: string; photoUrl: string | null }
  homework: {
    total: number
    done: number
    partial: number
    notDone: number
    submitted: number
    unmarked: number
  } | null
  attendance: { present: number; absent: number; sick: number; vacation: number } | null
  grades: { count: number; average: number | null } | null
  parentsCount: number
}

export interface HomeroomOverview {
  group: { id: string; name: string }
  days: number
  from: string
  to: string
  sections: { homework: boolean; attendance: boolean; grades: boolean }
  homeworkCount: number
  students: HomeroomRow[]
}

export const homeroomApi = {
  mine: () => http.get<HomeroomClass[]>('/v1/homeroom/mine').then((r) => r.data),
  overview: (groupId: string, days = 14) =>
    http.get<HomeroomOverview>(`/v1/homeroom/${groupId}/overview`, { params: { days } }).then((r) => r.data),
  notify: (groupId: string, body: { studentIds: string[]; text: string }) =>
    http.post<NotifyResult>(`/v1/homeroom/${groupId}/notify`, body).then((r) => r.data),
}
