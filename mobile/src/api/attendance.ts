import { http } from './http'

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'SICK' | 'VACATION'

export interface AttendanceDto {
  id: string
  studentId: string
  groupId: string
  date: string
  status: AttendanceStatus
  note: string | null
  student?: {
    id: string
    firstName: string
    lastName: string
    photoUrl: string | null
  }
}

export const attendanceApi = {
  listByDay: (date: string, groupId?: string) =>
    http
      .get<AttendanceDto[]>('/v1/attendance', { params: { date, groupId } })
      .then((r) => r.data),
  mark: (payload: {
    studentId: string
    date: string
    status: AttendanceStatus
    note?: string
  }) =>
    http
      .post<AttendanceDto>('/v1/attendance/mark', payload)
      .then((r) => r.data),
}
