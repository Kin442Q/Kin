import { http } from './http'

export interface DashboardDto {
  income: number
  extraIncome: number
  expenses: number
  fixedExpenses: number
  salaries: number
  taxes: number
  profit: number
  margin: number
  activeStudents: number
  totalStudents: number
  groups: number
}

export interface GroupDto {
  id: string
  name: string
  ageRange: string
  capacity: number
  monthlyFee: string
  color: string
  isActive: boolean
  _count?: { students: number; teachers: number }
}

export interface AdminPaymentDto {
  id: string
  studentId: string
  month: string
  amount: string
  paid: boolean
  paidAt: string | null
  method: 'CASH' | 'CARD' | 'TRANSFER' | null
  comment: string | null
  student?: {
    id: string
    firstName: string
    lastName: string
    groupId: string
    motherPhone: string | null
    fatherPhone: string | null
  }
}

export const adminApi = {
  dashboard: (month: string) =>
    http
      .get<DashboardDto>('/v1/analytics/dashboard', { params: { month } })
      .then((r) => r.data),
  groups: () =>
    http.get<GroupDto[]>('/v1/groups').then((r) => r.data),
  payments: (params: { month?: string; groupId?: string } = {}) =>
    http
      .get<AdminPaymentDto[]>('/v1/payments', { params })
      .then((r) => r.data),
}
