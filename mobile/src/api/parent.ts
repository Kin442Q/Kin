import { http } from './http'
import type { AttendanceDto, AttendanceStatus } from './attendance'

export interface KidDto {
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

export interface ScheduleItemDto {
  id: string
  groupId: string
  dayOfWeek: number // 1..7 Mon..Sun
  startTime: string // "HH:mm"
  endTime: string
  activity: string
}

export interface PaymentDto {
  id: string
  studentId: string
  month: string // "YYYY-MM"
  amount: string
  paid: boolean
  paidAt: string | null
  method: 'CASH' | 'CARD' | 'TRANSFER' | null
  comment: string | null
}

export interface KidTodayDto {
  kid: KidDto
  today: {
    attendance: { status: AttendanceStatus } | null
    schedule: ScheduleItemDto[]
  }
  lastPayment: PaymentDto | null
}

export const parentApi = {
  myKids: () =>
    http.get<KidDto[]>('/v1/parent/me/kids').then((r) => r.data),
  today: (kidId: string) =>
    http.get<KidTodayDto>(`/v1/parent/kids/${kidId}/today`).then((r) => r.data),
  schedule: (kidId: string) =>
    http
      .get<ScheduleItemDto[]>(`/v1/parent/kids/${kidId}/schedule`)
      .then((r) => r.data),
  attendance: (kidId: string, from: string, to: string) =>
    http
      .get<AttendanceDto[]>(`/v1/parent/kids/${kidId}/attendance`, {
        params: { from, to },
      })
      .then((r) => r.data),
  payments: (kidId: string) =>
    http
      .get<PaymentDto[]>(`/v1/parent/kids/${kidId}/payments`)
      .then((r) => r.data),
}
