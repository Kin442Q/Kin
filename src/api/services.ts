import { http } from './http'
import type {
  Child,
  Expense,
  ExtraIncome,
  Group,
  Payment,
  Staff,
  User,
} from '../types'

/**
 * Сервисный слой над HTTP. Каждый сервис — небольшая обёртка с типизацией
 * для соответствующего REST-эндпоинта на backend.
 *
 * Использование вместе с React Query:
 *   const { data } = useQuery({ queryKey: ['groups'], queryFn: groupsService.list })
 */

export const authService = {
  login: (email: string, password: string) =>
    http.post<{ token: string; user: User }>('/auth/login', { email, password }).then((r) => r.data),
}

export const groupsService = {
  list: () => http.get<Group[]>('/groups').then((r) => r.data),
  create: (data: Omit<Group, 'id' | 'createdAt'>) =>
    http.post<Group>('/groups', data).then((r) => r.data),
  update: (id: string, data: Partial<Group>) =>
    http.put<Group>(`/groups/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/groups/${id}`),
}

export const childrenService = {
  list: () => http.get<Child[]>('/children').then((r) => r.data),
  create: (data: Omit<Child, 'id' | 'createdAt'>) =>
    http.post<Child>('/children', data).then((r) => r.data),
  update: (id: string, data: Partial<Child>) =>
    http.put<Child>(`/children/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/children/${id}`),
}

export const staffService = {
  list: () => http.get<Staff[]>('/staff').then((r) => r.data),
  create: (data: Omit<Staff, 'id' | 'createdAt'>) =>
    http.post<Staff>('/staff', data).then((r) => r.data),
  update: (id: string, data: Partial<Staff>) =>
    http.put<Staff>(`/staff/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/staff/${id}`),
}

export const paymentsService = {
  list: (params: { month?: string; groupId?: string } = {}) =>
    http.get<Payment[]>('/payments', { params }).then((r) => r.data),
  upsert: (data: Omit<Payment, 'id' | 'createdAt'>) =>
    http.post<Payment>('/payments', data).then((r) => r.data),
  remove: (id: string) => http.delete(`/payments/${id}`),
}

export const expensesService = {
  list: (params: { month?: string; groupId?: string } = {}) =>
    http.get<Expense[]>('/expenses', { params }).then((r) => r.data),
  create: (data: Omit<Expense, 'id' | 'createdAt'>) =>
    http.post<Expense>('/expenses', data).then((r) => r.data),
  remove: (id: string) => http.delete(`/expenses/${id}`),
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
      }>(`/analytics/summary`, { params: { month } })
      .then((r) => r.data),
}
