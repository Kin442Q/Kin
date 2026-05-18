import { http } from './http'

export interface TimeEntryDto {
  id: string
  userId: string
  date: string
  checkIn: string
  checkOut: string | null
  minutesWorked: number | null
  verifyMethod: 'MANUAL' | 'FACE' | 'PIN' | 'QR' | 'TERMINAL'
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface TimeMonthSummary {
  month: string
  entries: TimeEntryDto[]
  totalMinutes: number
  totalHours: number
  workNorm: number
  salaryMode: 'HOURLY' | 'FIXED'
  hourlyRate: number
  fixedSalary: number
  estimatedSalary: number
  completionRate: number
}

export const timeApi = {
  checkIn: (
    verifyMethod: 'MANUAL' | 'FACE' = 'FACE',
    location?: { lat: number; lon: number },
  ) =>
    http
      .post<TimeEntryDto>('/v1/time/check-in', {
        verifyMethod,
        ...(location ? { lat: location.lat, lon: location.lon } : {}),
      })
      .then((r) => r.data),
  checkOut: () =>
    http.post<TimeEntryDto>('/v1/time/check-out', {}).then((r) => r.data),
  status: () =>
    http
      .get<{ isWorking: boolean; activeEntry: TimeEntryDto | null }>('/v1/time/status')
      .then((r) => r.data),
  myMonth: (month: string) =>
    http
      .get<TimeMonthSummary>('/v1/time/me', { params: { month } })
      .then((r) => r.data),
}
