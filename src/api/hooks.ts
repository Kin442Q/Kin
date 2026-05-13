import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  authService,
  usersService,
  groupsService,
  studentsService,
  teachersService,
  attendanceService,
  scheduleService,
  menuService,
  paymentsService,
  expensesService,
  extraIncomeService,
  analyticsService,
  notificationsService,
  healthService,
} from './services'
import type { AxiosError } from 'axios'

const defaultQueryOptions = {
  staleTime: 60_000,
  gcTime: 5 * 60 * 1000,
}

// ============ Auth ============
export const useLogin = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

export const useMe = () => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    ...defaultQueryOptions,
  })
}

export const useRefreshToken = () => {
  return useMutation({
    mutationFn: authService.refresh,
  })
}

// ============ Users ============
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: usersService.list,
    ...defaultQueryOptions,
  })
}

export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersService.getById(id),
    enabled: !!id,
    ...defaultQueryOptions,
  })
}

export const useCreateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export const useDeleteUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: usersService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// ============ Groups ============
export const useGroups = () => {
  return useQuery({
    queryKey: ['groups'],
    queryFn: groupsService.list,
    ...defaultQueryOptions,
  })
}

export const useGroup = (id: string) => {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => groupsService.getById(id),
    enabled: !!id,
    ...defaultQueryOptions,
  })
}

export const useCreateGroup = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: groupsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export const useUpdateGroup = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => groupsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export const useDeleteGroup = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: groupsService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

// ============ Students ============
export const useStudents = (groupId?: string) => {
  return useQuery({
    queryKey: ['students', groupId],
    queryFn: () => studentsService.list(groupId),
    ...defaultQueryOptions,
  })
}

export const useStudent = (id: string) => {
  return useQuery({
    queryKey: ['students', id],
    queryFn: () => studentsService.getById(id),
    enabled: !!id,
    ...defaultQueryOptions,
  })
}

export const useCreateStudent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: studentsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export const useUpdateStudent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => studentsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export const useDeleteStudent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: studentsService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

// ============ Teachers ============
export const useTeachers = () => {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: teachersService.list,
    ...defaultQueryOptions,
  })
}

export const useTeacher = (id: string) => {
  return useQuery({
    queryKey: ['teachers', id],
    queryFn: () => teachersService.getById(id),
    enabled: !!id,
    ...defaultQueryOptions,
  })
}

export const useCreateTeacher = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: teachersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

export const useUpdateTeacher = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teachersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

export const useDeleteTeacher = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: teachersService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

// ============ Attendance ============
export const useAttendanceRecords = (params?: {
  childId?: string
  date?: string
  month?: string
}) => {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceService.list(params),
    ...defaultQueryOptions,
  })
}

export const useAttendanceRecord = (id: string) => {
  return useQuery({
    queryKey: ['attendance', id],
    queryFn: () => attendanceService.getById(id),
    enabled: !!id,
    ...defaultQueryOptions,
  })
}

export const useRecordAttendance = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: attendanceService.recordAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

export const useBulkRecordAttendance = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: attendanceService.bulkRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

export const useUpdateAttendance = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => attendanceService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

export const useDeleteAttendance = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: attendanceService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

// ============ Schedule ============
export const useSchedule = (groupId?: string) => {
  return useQuery({
    queryKey: ['schedule', groupId],
    queryFn: () => scheduleService.list(groupId),
    ...defaultQueryOptions,
  })
}

export const useCreateScheduleItem = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scheduleService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

export const useUpdateScheduleItem = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => scheduleService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

export const useDeleteScheduleItem = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scheduleService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

// ============ Menu ============
export const useMenuByMonth = (month: string) => {
  return useQuery({
    queryKey: ['menu', 'month', month],
    queryFn: () => menuService.listByMonth(month),
    enabled: !!month,
    ...defaultQueryOptions,
  })
}

export const useMenuByDate = (date: string) => {
  return useQuery({
    queryKey: ['menu', 'date', date],
    queryFn: () => menuService.listByDate(date),
    enabled: !!date,
    ...defaultQueryOptions,
  })
}

export const useCreateMenuItem = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: menuService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })
}

export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => menuService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })
}

export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: menuService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })
}

// ============ Payments ============
export const usePayments = (params?: {
  month?: string
  groupId?: string
  childId?: string
}) => {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => paymentsService.list(params),
    ...defaultQueryOptions,
  })
}

export const usePayment = (id: string) => {
  return useQuery({
    queryKey: ['payments', id],
    queryFn: () => paymentsService.getById(id),
    enabled: !!id,
    ...defaultQueryOptions,
  })
}

export const useCreatePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: paymentsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

export const useUpdatePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => paymentsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

export const useDeletePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: paymentsService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

// ============ Expenses ============
export const useExpenses = (params?: {
  month?: string
  groupId?: string
  category?: string
}) => {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => expensesService.list(params),
    ...defaultQueryOptions,
  })
}

export const useExpense = (id: string) => {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: () => expensesService.getById(id),
    enabled: !!id,
    ...defaultQueryOptions,
  })
}

export const useCreateExpense = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: expensesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export const useUpdateExpense = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => expensesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export const useDeleteExpense = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: expensesService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

// ============ Extra Income ============
export const useExtraIncomeList = (params?: { month?: string; groupId?: string }) => {
  return useQuery({
    queryKey: ['extraIncome', params],
    queryFn: () => extraIncomeService.list(params),
    ...defaultQueryOptions,
  })
}

export const useCreateExtraIncome = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: extraIncomeService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extraIncome'] })
    },
  })
}

export const useUpdateExtraIncome = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      extraIncomeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extraIncome'] })
    },
  })
}

export const useDeleteExtraIncome = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: extraIncomeService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extraIncome'] })
    },
  })
}

// ============ Analytics ============
export const useAnalyticsSummary = (month: string) => {
  return useQuery({
    queryKey: ['analytics', 'summary', month],
    queryFn: () => analyticsService.summary(month),
    enabled: !!month,
    ...defaultQueryOptions,
  })
}

export const useGroupAnalytics = (groupId: string, month: string) => {
  return useQuery({
    queryKey: ['analytics', 'group', groupId, month],
    queryFn: () => analyticsService.groupAnalytics(groupId, month),
    enabled: !!groupId && !!month,
    ...defaultQueryOptions,
  })
}

export const useAnalyticsTrend = (months: number = 12) => {
  return useQuery({
    queryKey: ['analytics', 'trend', months],
    queryFn: () => analyticsService.trend(months),
    ...defaultQueryOptions,
  })
}

// ============ Notifications ============
export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsService.list,
    ...defaultQueryOptions,
  })
}

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: notificationsService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export const useDeleteNotification = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: notificationsService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// ============ Health ============
export const useHealthStatus = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: healthService.status,
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  })
}
