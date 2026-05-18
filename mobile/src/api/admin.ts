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

export type ExpenseCategory =
  | 'SALARIES' | 'TAXES' | 'RENT' | 'UTILITIES' | 'FOOD' | 'TOYS'
  | 'STATIONERY' | 'INTERNET' | 'CLEANING' | 'REPAIRS' | 'EDUCATION' | 'OTHER'

export interface ExpenseDto {
  id: string
  category: ExpenseCategory
  description: string
  amount: string
  month: string
  groupId: string | null
  createdAt: string
}

export interface MeetingDto {
  id: string
  groupId: string
  title: string
  scheduledAt: string
  location: string | null
  description: string | null
  createdAt: string
  group?: { id: string; name: string; color: string | null }
}

export interface AdminStudentDto {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  photoUrl: string | null
  motherName: string | null
  motherPhone: string | null
  fatherName: string | null
  fatherPhone: string | null
  monthlyFee: string | null
  status: 'ACTIVE' | 'ARCHIVED' | 'WAITLIST'
  groupId: string
  group?: { id: string; name: string; color: string | null } | null
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
  upsertPayment: (dto: {
    studentId: string
    month: string
    amount: number
    paid: boolean
    method?: 'CASH' | 'CARD' | 'TRANSFER'
    comment?: string
  }) =>
    http
      .post<AdminPaymentDto>('/v1/payments/upsert', dto)
      .then((r) => r.data),
  students: (params: { groupId?: string; status?: string } = {}) =>
    http
      .get<AdminStudentDto[]>('/v1/students', { params })
      .then((r) => r.data),
  expenses: (params: { month?: string; groupId?: string } = {}) =>
    http.get<ExpenseDto[]>('/v1/expenses', { params }).then((r) => r.data),
  createExpense: (dto: {
    category: ExpenseCategory
    description: string
    amount: number
    month: string
    groupId?: string | null
  }) => http.post<ExpenseDto>('/v1/expenses', dto).then((r) => r.data),
  deleteExpense: (id: string) =>
    http.delete(`/v1/expenses/${id}`).then((r) => r.data),
  meetings: (groupId?: string) =>
    http
      .get<MeetingDto[]>('/v1/meetings', { params: { groupId } })
      .then((r) => r.data),
  createMeeting: (dto: {
    groupId: string
    title: string
    scheduledAt: string
    location?: string
    description?: string
  }) => http.post<MeetingDto>('/v1/meetings', dto).then((r) => r.data),
}
