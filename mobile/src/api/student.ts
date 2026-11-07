import { http } from './http'

/* ============================================================
   Кабинет ученика (/v1/student/*) и статусы домашних заданий.
   Зеркало web/src/api/schoolApi.ts. Ответы бэкенда распаковывает
   интерцептор http, поэтому здесь сразу данные.
   ============================================================ */

export type SubmissionStatus = 'SUBMITTED' | 'DONE' | 'PARTIAL' | 'NOT_DONE'

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  SUBMITTED: 'Отмечено «сделал»',
  DONE: 'Выполнено',
  PARTIAL: 'Частично',
  NOT_DONE: 'Не выполнено',
}

export interface SubjectRef {
  id: string
  name: string
  color: string
}

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
  subject: SubjectRef
  submission: {
    status: SubmissionStatus
    comment: string | null
    updatedAt: string
  } | null
}

export interface StudentGrade {
  id: string
  value: number
  type: string
  date: string
  comment: string | null
  subject: SubjectRef
}

export interface StudentGrades {
  items: StudentGrade[]
  averages: Array<{ subject: SubjectRef; count: number; average: number }>
}

export interface StudentLesson {
  id: string
  dayOfWeek: number // 1..7, Пн..Вс
  startTime: string // "HH:mm"
  endTime: string
  activity: string
  room: string | null
  subject: SubjectRef | null
}

/** Серия дней, очки и уровень ученика (считает сервер из квизов, игр и отметок «сделал»). */
export interface StudentProgress {
  xp: number
  level: number
  /** XP внутри текущего уровня и сколько их в уровне. */
  xpIntoLevel: number
  levelSize: number
  streakDays: number
}

export const studentApi = {
  progress: () => http.get<StudentProgress>('/v1/student/progress').then((r) => r.data),
  me: () => http.get<StudentProfile>('/v1/student/me').then((r) => r.data),
  homework: (params?: { from?: string; to?: string }) =>
    http
      .get<StudentHomework[]>('/v1/student/homework', { params })
      .then((r) => r.data),
  /** Ученик отмечает «сделал» (или снимает отметку). Вердикт учителя не перезаписывается. */
  setSubmitted: (homeworkId: string, submitted: boolean) =>
    http
      .put<{ status: SubmissionStatus | null }>(
        `/v1/student/homework/${homeworkId}/submitted`,
        { submitted },
      )
      .then((r) => r.data),
  grades: () => http.get<StudentGrades>('/v1/student/grades').then((r) => r.data),
  schedule: () =>
    http.get<StudentLesson[]>('/v1/student/schedule').then((r) => r.data),
}
