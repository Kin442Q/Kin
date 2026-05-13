import { http } from './http'
import type {
  AttendanceRecord,
  AttendanceStatus,
  Child,
  Expense,
  ExtraIncome,
  Group,
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
      .post<{ accessToken: string; refreshToken?: string; user: User }>('/auth/login', {
        email,
        password,
      })
      .then((r) => r.data),
  logout: () => http.post('/auth/logout', {}).then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
  refresh: () =>
    http.post<{ accessToken: string }>('/auth/refresh', {}).then((r) => r.data),
}

export const usersService = {
  list: () => http.get<User[]>('/users').then((r) => r.data),
  getById: (id: string) => http.get<User>(`/users/${id}`).then((r) => r.data),
  create: (data: Omit<User, 'id'>) => http.post<User>('/users', data).then((r) => r.data),
  update: (id: string, data: Partial<User>) =>
    http.put<User>(`/users/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/users/${id}`),
}

export const groupsService = {
  list: () => http.get<Group[]>('/groups').then((r) => r.data),
  getById: (id: string) => http.get<Group>(`/groups/${id}`).then((r) => r.data),
  create: (data: Omit<Group, 'id' | 'createdAt'>) =>
    http.post<Group>('/groups', data).then((r) => r.data),
  update: (id: string, data: Partial<Group>) =>
    http.put<Group>(`/groups/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/groups/${id}`),
}

export const studentsService = {
  list: (groupId?: string) =>
    http
      .get<Child[]>('/students', { params: groupId ? { groupId } : {} })
      .then((r) => r.data),
  getById: (id: string) => http.get<Child>(`/students/${id}`).then((r) => r.data),
  create: (data: Omit<Child, 'id' | 'createdAt'>) =>
    http.post<Child>('/students', data).then((r) => r.data),
  update: (id: string, data: Partial<Child>) =>
    http.put<Child>(`/students/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/students/${id}`),
}

export const teachersService = {
  list: () => http.get<Staff[]>('/teachers').then((r) => r.data),
  getById: (id: string) => http.get<Staff>(`/teachers/${id}`).then((r) => r.data),
  create: (data: Omit<Staff, 'id' | 'createdAt'>) =>
    http.post<Staff>('/teachers', data).then((r) => r.data),
  update: (id: string, data: Partial<Staff>) =>
    http.put<Staff>(`/teachers/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/teachers/${id}`),
}

export const attendanceService = {
  list: (params: { childId?: string; date?: string; month?: string } = {}) =>
    http.get<AttendanceRecord[]>('/attendance', { params }).then((r) => r.data),
  getById: (id: string) => http.get<AttendanceRecord>(`/attendance/${id}`).then((r) => r.data),
  recordAttendance: (data: Omit<AttendanceRecord, 'id'>) =>
    http.post<AttendanceRecord>('/attendance', data).then((r) => r.data),
  bulkRecord: (data: Omit<AttendanceRecord, 'id'>[]) =>
    http.post<AttendanceRecord[]>('/attendance/bulk', data).then((r) => r.data),
  update: (id: string, data: Partial<AttendanceRecord>) =>
    http.put<AttendanceRecord>(`/attendance/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/attendance/${id}`),
}

export const scheduleService = {
  list: (groupId?: string) =>
    http
      .get<ScheduleItem[]>('/schedule', { params: groupId ? { groupId } : {} })
      .then((r) => r.data),
  create: (data: Omit<ScheduleItem, 'id'>) =>
    http.post<ScheduleItem>('/schedule', data).then((r) => r.data),
  update: (id: string, data: Partial<ScheduleItem>) =>
    http.put<ScheduleItem>(`/schedule/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/schedule/${id}`),
}

export const menuService = {
  listByMonth: (month: string) =>
    http.get<MenuItem[]>('/menu', { params: { month } }).then((r) => r.data),
  listByDate: (date: string) =>
    http.get<MenuItem[]>('/menu', { params: { date } }).then((r) => r.data),
  create: (data: Omit<MenuItem, 'id'>) =>
    http.post<MenuItem>('/menu', data).then((r) => r.data),
  update: (id: string, data: Partial<MenuItem>) =>
    http.put<MenuItem>(`/menu/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/menu/${id}`),
}

export const paymentsService = {
  list: (params: { month?: string; groupId?: string; childId?: string } = {}) =>
    http.get<Payment[]>('/payments', { params }).then((r) => r.data),
  getById: (id: string) => http.get<Payment>(`/payments/${id}`).then((r) => r.data),
  create: (data: Omit<Payment, 'id' | 'createdAt'>) =>
    http.post<Payment>('/payments', data).then((r) => r.data),
  update: (id: string, data: Partial<Payment>) =>
    http.put<Payment>(`/payments/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/payments/${id}`),
}

export const expensesService = {
  list: (params: { month?: string; groupId?: string; category?: string } = {}) =>
    http.get<Expense[]>('/expenses', { params }).then((r) => r.data),
  getById: (id: string) => http.get<Expense>(`/expenses/${id}`).then((r) => r.data),
  create: (data: Omit<Expense, 'id' | 'createdAt'>) =>
    http.post<Expense>('/expenses', data).then((r) => r.data),
  update: (id: string, data: Partial<Expense>) =>
    http.put<Expense>(`/expenses/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/expenses/${id}`),
}

export const extraIncomeService = {
  list: (params: { month?: string; groupId?: string } = {}) =>
    http.get<ExtraIncome[]>('/extra-income', { params }).then((r) => r.data),
  create: (data: Omit<ExtraIncome, 'id' | 'createdAt'>) =>
    http.post<ExtraIncome>('/extra-income', data).then((r) => r.data),
  update: (id: string, data: Partial<ExtraIncome>) =>
    http.put<ExtraIncome>(`/extra-income/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/extra-income/${id}`),
}

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
      }>('/analytics/summary', { params: { month } })
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
      }>(`/analytics/groups/${groupId}`, { params: { month } })
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
      >('/analytics/trend', { params: { months } })
      .then((r) => r.data),
}

export const notificationsService = {
  list: () => http.get<AppNotification[]>('/notifications').then((r) => r.data),
  markAsRead: (id: string) =>
    http.put<AppNotification>(`/notifications/${id}/read`, {}).then((r) => r.data),
  markAllAsRead: () =>
    http.put<void>('/notifications/read-all', {}).then((r) => r.data),
  remove: (id: string) => http.delete(`/notifications/${id}`),
}

export const healthService = {
  status: () =>
    http
      .get<{
        status: 'ok' | 'error'
        uptime: number
        timestamp: string
      }>('/health')
      .then((r) => r.data),
}
