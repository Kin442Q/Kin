/**
 * API родителя — обёртка над /v1/parent/*.
 * Все эндпоинты разрешают только аккаунты с role=PARENT и автоматически
 * фильтруют по childId / Student.parents[].
 */
import { http } from './http'

export interface ParentKid {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  photoUrl: string | null
  birthDate: string
  groupId: string
  group?: {
    id: string
    name: string
    color: string | null
    ageRange: string
  } | null
}

export interface ParentAttendance {
  status: 'PRESENT' | 'ABSENT' | 'SICK' | 'VACATION'
}

export interface ParentScheduleItem {
  id: string
  groupId: string
  dayOfWeek: number // 1..7
  startTime: string
  endTime: string
  activity: string
  subjectId?: string | null
  teacherId?: string | null
  room?: string | null
  subject?: { id: string; name: string; color: string } | null
}

export interface ParentPayment {
  id: string
  studentId: string
  month: string
  amount: string | number
  paid: boolean
  paidAt: string | null
  method: 'CASH' | 'CARD' | 'TRANSFER' | null
  comment: string | null
}

export interface ParentDiary {
  id: string
  groupId: string
  date: string
  breakfast: string | null
  lunch: string | null
  snack: string | null
  activities: string | null
  note: string | null
}

export interface ParentKidNote {
  id: string
  studentId: string
  date: string
  mood: 'HAPPY' | 'NEUTRAL' | 'SAD' | 'SICK' | null
  napQuality: 'GOOD' | 'NORMAL' | 'POOR' | 'NO_NAP' | null
  note: string | null
  photoUrls: string[]
}

export interface ParentToday {
  kid: ParentKid
  today: {
    attendance: ParentAttendance | null
    schedule: ParentScheduleItem[]
    diary: ParentDiary | null
    kidNote: ParentKidNote | null
  }
  lastPayment: ParentPayment | null
}

export interface ParentGrade {
  id: string
  studentId: string
  subjectId: string
  value: number
  type: 'CLASSWORK' | 'HOMEWORK' | 'CONTROL' | 'EXAM' | 'PROJECT' | 'OTHER'
  date: string
  comment: string | null
  subject?: { id: string; name: string; color: string }
  author?: { id: string; fullName: string }
}

export interface ParentGradeStats {
  subjectId: string
  name: string
  color: string
  count: number
  sum: number
  average: number
}

export interface ParentHomework {
  id: string
  subjectId: string
  groupId: string
  title: string
  description: string | null
  dueDate: string
  attachments: string[]
  subject?: { id: string; name: string; color: string }
}

export const parentApi = {
  myKids: () =>
    http.get<ParentKid[]>('/v1/parent/me/kids').then((r) => r.data),
  today: (kidId: string) =>
    http
      .get<ParentToday>(`/v1/parent/kids/${kidId}/today`)
      .then((r) => r.data),
  schedule: (kidId: string) =>
    http
      .get<ParentScheduleItem[]>(`/v1/parent/kids/${kidId}/schedule`)
      .then((r) => r.data),
  payments: (kidId: string) =>
    http
      .get<ParentPayment[]>(`/v1/parent/kids/${kidId}/payments`)
      .then((r) => r.data),
  grades: (kidId: string) =>
    http
      .get<ParentGrade[]>(`/v1/parent/kids/${kidId}/grades`)
      .then((r) => r.data),
  gradeStats: (kidId: string) =>
    http
      .get<ParentGradeStats[]>(`/v1/parent/kids/${kidId}/grades/stats`)
      .then((r) => r.data),
  homework: (kidId: string) =>
    http
      .get<ParentHomework[]>(`/v1/parent/kids/${kidId}/homework`)
      .then((r) => r.data),
}
