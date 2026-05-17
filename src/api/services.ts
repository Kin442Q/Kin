import { http } from './http'
import type {
  AttendanceRecord,
  Child,
  Expense,
  ExtraIncome,
  Group,
  Meeting,
  MenuItem,
  Payment,
  ScheduleItem,
  Staff,
  User,
  AppNotification,
} from '../types'

export const authService = {
  login: (email: string, password: string) =>
    http
      .post<{ accessToken: string; refreshToken?: string; user: User }>(
        '/v1/auth/login',
        { email, password },
      )
      .then((r) => r.data),
  logout: () => http.post('/v1/auth/logout', {}).then((r) => r.data),
  me: () => http.get<User>('/v1/auth/me').then((r) => r.data),
  refresh: () =>
    http.post<{ accessToken: string }>('/v1/auth/refresh', {}).then((r) => r.data),
}

export const usersService = {
  list: () => http.get<User[]>('/v1/users').then((r) => r.data),
  getById: (id: string) => http.get<User>(`/v1/users/${id}`).then((r) => r.data),
  create: (data: Omit<User, 'id'>) =>
    http.post<User>('/v1/users', data).then((r) => r.data),
  update: (id: string, data: Partial<User>) =>
    http.patch<User>(`/v1/users/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/users/${id}`),
}

// Groups
export const groupsService = {
  list: () => http.get<Group[]>('/v1/groups').then((r) => r.data),
  getById: (id: string) => http.get<Group>(`/v1/groups/${id}`).then((r) => r.data),
  create: (data: Omit<Group, 'id' | 'createdAt'>) =>
    http.post<Group>('/v1/groups', data).then((r) => r.data),
  update: (id: string, data: Partial<Group>) =>
    http.patch<Group>(`/v1/groups/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/groups/${id}`),
}

// Students
export const studentsService = {
  list: (groupId?: string) =>
    http
      .get<Child[]>('/v1/students', { params: groupId ? { groupId } : {} })
      .then((r) => r.data),
  getById: (id: string) => http.get<Child>(`/v1/students/${id}`).then((r) => r.data),
  create: (data: Omit<Child, 'id' | 'createdAt'>) =>
    http.post<Child>('/v1/students', data).then((r) => r.data),
  update: (id: string, data: Partial<Child>) =>
    http.patch<Child>(`/v1/students/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/students/${id}`),
}

// Teachers (via users endpoint)
export const teachersService = {
  list: () => http.get<Staff[]>('/v1/users/teachers').then((r) => r.data),
  getById: (id: string) => http.get<Staff>(`/v1/users/${id}`).then((r) => r.data),
  create: (data: {
    fullName: string
    phone: string
    email?: string
    password: string
    groupId?: string
  }) => http.post<Staff>('/v1/users/teacher', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    http.patch<Staff>(`/v1/users/teacher/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/users/teacher/${id}`),
}

// Attendance
export const attendanceService = {
  list: (params: { childId?: string; date?: string; month?: string } = {}) =>
    http.get<AttendanceRecord[]>('/v1/attendance', { params }).then((r) => r.data),
  getById: (id: string) =>
    http.get<AttendanceRecord>(`/v1/attendance/${id}`).then((r) => r.data),
  recordAttendance: (data: Omit<AttendanceRecord, 'id'>) =>
    http.post<AttendanceRecord>('/v1/attendance', data).then((r) => r.data),
  bulkRecord: (data: Omit<AttendanceRecord, 'id'>[]) =>
    http.post<AttendanceRecord[]>('/v1/attendance/bulk', data).then((r) => r.data),
  update: (id: string, data: Partial<AttendanceRecord>) =>
    http.patch<AttendanceRecord>(`/v1/attendance/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/attendance/${id}`),
}

// Schedule
export const scheduleService = {
  list: (groupId?: string) =>
    http
      .get<ScheduleItem[]>('/v1/schedule', { params: groupId ? { groupId } : {} })
      .then((r) => r.data),
  create: (data: Omit<ScheduleItem, 'id'>) =>
    http.post<ScheduleItem>('/v1/schedule', data).then((r) => r.data),
  update: (id: string, data: Partial<ScheduleItem>) =>
    http.patch<ScheduleItem>(`/v1/schedule/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/schedule/${id}`),
}

// Menu
export const menuService = {
  listByMonth: (month: string) =>
    http.get<MenuItem[]>('/v1/menu', { params: { month } }).then((r) => r.data),
  listByDate: (date: string) =>
    http.get<MenuItem[]>('/v1/menu', { params: { date } }).then((r) => r.data),
  create: (data: Omit<MenuItem, 'id'>) =>
    http.post<MenuItem>('/v1/menu', data).then((r) => r.data),
  update: (id: string, data: Partial<MenuItem>) =>
    http.patch<MenuItem>(`/v1/menu/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/menu/${id}`),
}

// Payments
export const paymentsService = {
  list: (params: { month?: string; groupId?: string; childId?: string } = {}) =>
    http.get<Payment[]>('/v1/payments', { params }).then((r) => r.data),
  getById: (id: string) => http.get<Payment>(`/v1/payments/${id}`).then((r) => r.data),
  create: (data: Omit<Payment, 'id' | 'createdAt'>) =>
    http.post<Payment>('/v1/payments', data).then((r) => r.data),
  update: (id: string, data: Partial<Payment>) =>
    http.patch<Payment>(`/v1/payments/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/payments/${id}`),
}

// Expenses
export const expensesService = {
  list: (params: { month?: string; groupId?: string; category?: string } = {}) =>
    http.get<Expense[]>('/v1/expenses', { params }).then((r) => r.data),
  getById: (id: string) => http.get<Expense>(`/v1/expenses/${id}`).then((r) => r.data),
  create: (data: Omit<Expense, 'id' | 'createdAt'>) =>
    http.post<Expense>('/v1/expenses', data).then((r) => r.data),
  update: (id: string, data: Partial<Expense>) =>
    http.patch<Expense>(`/v1/expenses/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/expenses/${id}`),
}

// Extra income
export const extraIncomeService = {
  list: (params: { month?: string; groupId?: string } = {}) =>
    http.get<ExtraIncome[]>('/v1/extra-income', { params }).then((r) => r.data),
  create: (data: Omit<ExtraIncome, 'id' | 'createdAt'>) =>
    http.post<ExtraIncome>('/v1/extra-income', data).then((r) => r.data),
  update: (id: string, data: Partial<ExtraIncome>) =>
    http.patch<ExtraIncome>(`/v1/extra-income/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/extra-income/${id}`),
}

// Analytics
export const analyticsService = {
  summary: (month: string) =>
    http
      .get<{
        month: string
        totalIncome: number
        totalExpenses: number
        netProfit: number
        margin: number
        salaries: number
        taxes: number
        isProfitable: boolean
      }>('/v1/analytics/summary', { params: { month } })
      .then((r) => r.data),
  groupAnalytics: (groupId: string, month: string) =>
    http
      .get<{
        groupId: string
        month: string
        income: number
        expenses: number
        profit: number
        margin: number
        studentsCount: number
        attendanceRate: number
      }>(`/v1/analytics/groups/${groupId}`, { params: { month } })
      .then((r) => r.data),
  trend: (months: number = 12) =>
    http
      .get<
        Array<{
          month: string
          income: number
          expenses: number
          profit: number
          margin: number
        }>
      >('/v1/analytics/trend', { params: { months } })
      .then((r) => r.data),
}

// Time-tracking (приход/уход учителей + зарплата)
export interface TimeEntryDto {
  id: string
  userId: string
  date: string
  checkIn: string
  checkOut: string | null
  minutesWorked: number | null
  verifyMethod: 'MANUAL' | 'FACE' | 'PIN' | 'QR'
  note: string | null
  editedByAdminId: string | null
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

export const timeService = {
  checkIn: (verifyMethod: 'MANUAL' | 'FACE' = 'MANUAL', note?: string) =>
    http
      .post<TimeEntryDto>('/v1/time/check-in', { verifyMethod, note })
      .then((r) => r.data),
  checkOut: (note?: string) =>
    http.post<TimeEntryDto>('/v1/time/check-out', { note }).then((r) => r.data),
  status: () =>
    http
      .get<{ isWorking: boolean; activeEntry: TimeEntryDto | null }>(
        '/v1/time/status',
      )
      .then((r) => r.data),
  myMonth: (month: string) =>
    http
      .get<TimeMonthSummary>('/v1/time/me', { params: { month } })
      .then((r) => r.data),

  // Face ID
  setFace: (descriptor: number[]) =>
    http.post('/v1/time/face', { descriptor }).then((r) => r.data),
  getFace: () =>
    http
      .get<{ hasFace: boolean; descriptor: number[] | null }>('/v1/time/face')
      .then((r) => r.data),

  // Admin
  allTeachers: (month: string) =>
    http
      .get<
        Array<{
          teacher: {
            id: string
            fullName: string
            avatarUrl: string | null
            groupId: string | null
            salaryMode: 'HOURLY' | 'FIXED'
            hourlyRate: number | null
            monthlySalaryFixed: number | null
            workNorm: number
          }
          totalMinutes: number
          totalHours: number
          estimatedSalary: number
          entries: TimeEntryDto[]
        }>
      >('/v1/time/teachers', { params: { month } })
      .then((r) => r.data),
  updateEntry: (
    id: string,
    data: Partial<{ checkIn: string; checkOut: string | null; note: string }>,
  ) => http.patch<TimeEntryDto>(`/v1/time/${id}`, data).then((r) => r.data),
  removeEntry: (id: string) => http.delete(`/v1/time/${id}`),
  setTeacherSalary: (
    teacherId: string,
    data: {
      salaryMode?: 'HOURLY' | 'FIXED'
      hourlyRate?: number
      monthlySalaryFixed?: number
      workNorm?: number
    },
  ) =>
    http
      .patch(`/v1/time/teacher/${teacherId}/salary`, data)
      .then((r) => r.data),
}

// Terminal settings (Hikvision/ZKTeco webhook)
export interface TerminalSettings {
  kindergartenId: string
  kindergartenName: string
  hasApiKey: boolean
  apiKey: string | null
  webhookUrl: string
}

export const terminalService = {
  getSettings: () =>
    http
      .get<TerminalSettings>('/v1/time/terminal/settings')
      .then((r) => r.data),
  regenerate: () =>
    http
      .post<{ apiKey: string }>('/v1/time/terminal/settings/regenerate')
      .then((r) => r.data),
  disable: () =>
    http
      .post<{ success: boolean }>('/v1/time/terminal/settings/disable')
      .then((r) => r.data),
  setTeacherCode: (teacherId: string, terminalCode: string | null) =>
    http
      .post<{ id: string; fullName: string; terminalCode: string | null }>(
        `/v1/time/terminal/settings/teacher/${teacherId}/code`,
        { terminalCode },
      )
      .then((r) => r.data),
}

// Meetings (родительские собрания)
export const meetingsService = {
  list: (groupId?: string) =>
    http
      .get<Meeting[]>('/v1/meetings', { params: groupId ? { groupId } : {} })
      .then((r) => r.data),
  create: (data: {
    groupId: string
    title: string
    scheduledAt: string
    location?: string
    description?: string
  }) => http.post<Meeting>('/v1/meetings', data).then((r) => r.data),
  update: (
    id: string,
    data: Partial<{
      title: string
      scheduledAt: string
      location: string
      description: string
    }>,
  ) => http.patch<Meeting>(`/v1/meetings/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/meetings/${id}`),
}

// Notifications
export const notificationsService = {
  list: () => http.get<AppNotification[]>('/v1/notifications').then((r) => r.data),
  markAsRead: (id: string) =>
    http.patch<AppNotification>(`/v1/notifications/${id}/read`, {}).then((r) => r.data),
  markAllAsRead: () =>
    http.patch<void>('/v1/notifications/read-all', {}).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/notifications/${id}`),
}

export const healthService = {
  status: () =>
    http
      .get<{
        status: 'ok' | 'error'
        uptime: number
        timestamp: string
      }>('/v1/health')
      .then((r) => r.data),
}
