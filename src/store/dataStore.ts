import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Account,
  AttendanceRecord,
  Child,
  Expense,
  ExtraIncome,
  Group,
  MenuItem,
  Payment,
  ScheduleItem,
  Staff,
  AppNotification,
} from '../types'
import { uid } from '../lib/uid'

/* ============================================================
   Главный store данных. Хранится в localStorage. В реальном проекте
   методы заменяются на API-вызовы (Axios + React Query), а сама
   структура мутаций остаётся ровно такой же.
   ============================================================ */

interface DataState {
  groups: Group[]
  children: Child[]
  staff: Staff[]
  attendance: AttendanceRecord[]
  payments: Payment[]
  expenses: Expense[]
  extraIncome: ExtraIncome[]
  schedule: ScheduleItem[]
  menu: MenuItem[]
  notifications: AppNotification[]
  accounts: Account[]

  // Bulk hydration (from backend API)
  setGroups: (groups: Group[]) => void
  setChildren: (children: Child[]) => void

  // Mutations
  upsertGroup: (g: Group) => void
  deleteGroup: (id: string) => void

  upsertAccount: (a: Account) => void
  deleteAccount: (id: string) => void

  upsertChild: (c: Child) => void
  deleteChild: (id: string) => void

  upsertStaff: (s: Staff) => void
  deleteStaff: (id: string) => void

  upsertAttendance: (a: AttendanceRecord) => void
  deleteAttendance: (id: string) => void

  upsertPayment: (p: Payment) => void
  deletePayment: (id: string) => void

  upsertExpense: (e: Expense) => void
  deleteExpense: (id: string) => void

  upsertExtraIncome: (e: ExtraIncome) => void
  deleteExtraIncome: (id: string) => void

  upsertSchedule: (s: ScheduleItem) => void
  deleteSchedule: (id: string) => void

  upsertMenu: (m: MenuItem) => void
  deleteMenu: (id: string) => void

  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void
  markAllNotificationsRead: () => void

  /** Полное заполнение демо-данных */
  seedDemo: () => void
  /** Полный сброс */
  resetAll: () => void
}

const upsertById = <T extends { id: string }>(arr: T[], item: T): T[] => {
  const i = arr.findIndex((x) => x.id === item.id)
  if (i === -1) return [item, ...arr]
  const next = [...arr]
  next[i] = item
  return next
}

const removeById = <T extends { id: string }>(arr: T[], id: string) =>
  arr.filter((x) => x.id !== id)

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      groups: [],
      children: [],
      staff: [],
      attendance: [],
      payments: [],
      expenses: [],
      extraIncome: [],
      schedule: [],
      menu: [],
      notifications: [],
      accounts: [],

      upsertAccount: (a) => set((s) => ({ accounts: upsertById(s.accounts, a) })),
      deleteAccount: (id) => set((s) => ({ accounts: removeById(s.accounts, id) })),

      setGroups: (groups) => set(() => ({ groups })),
      setChildren: (children) => set(() => ({ children })),

      upsertGroup: (g) => set((s) => ({ groups: upsertById(s.groups, g) })),
      deleteGroup: (id) =>
        set((s) => ({
          groups: removeById(s.groups, id),
          // отвязываем сущности
          children: s.children.map((c) =>
            c.groupId === id ? { ...c, groupId: '' } : c,
          ),
          staff: s.staff.map((p) =>
            p.groupId === id ? { ...p, groupId: undefined } : p,
          ),
        })),

      upsertChild: (c) => set((s) => ({ children: upsertById(s.children, c) })),
      deleteChild: (id) =>
        set((s) => ({
          children: removeById(s.children, id),
          attendance: s.attendance.filter((a) => a.childId !== id),
          payments: s.payments.filter((p) => p.childId !== id),
        })),

      upsertStaff: (st) => set((s) => ({ staff: upsertById(s.staff, st) })),
      deleteStaff: (id) => set((s) => ({ staff: removeById(s.staff, id) })),

      upsertAttendance: (a) =>
        set((s) => ({ attendance: upsertById(s.attendance, a) })),
      deleteAttendance: (id) =>
        set((s) => ({ attendance: removeById(s.attendance, id) })),

      upsertPayment: (p) => set((s) => ({ payments: upsertById(s.payments, p) })),
      deletePayment: (id) =>
        set((s) => ({ payments: removeById(s.payments, id) })),

      upsertExpense: (e) => set((s) => ({ expenses: upsertById(s.expenses, e) })),
      deleteExpense: (id) =>
        set((s) => ({ expenses: removeById(s.expenses, id) })),

      upsertExtraIncome: (e) =>
        set((s) => ({ extraIncome: upsertById(s.extraIncome, e) })),
      deleteExtraIncome: (id) =>
        set((s) => ({ extraIncome: removeById(s.extraIncome, id) })),

      upsertSchedule: (sch) =>
        set((s) => ({ schedule: upsertById(s.schedule, sch) })),
      deleteSchedule: (id) =>
        set((s) => ({ schedule: removeById(s.schedule, id) })),

      upsertMenu: (m) => set((s) => ({ menu: upsertById(s.menu, m) })),
      deleteMenu: (id) => set((s) => ({ menu: removeById(s.menu, id) })),

      pushNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: uid(),
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...s.notifications,
          ].slice(0, 50),
        })),
      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      seedDemo: () => set(() => ({
        groups: [],
        children: [],
        staff: [],
        attendance: [],
        payments: [],
        expenses: [],
        extraIncome: [],
        schedule: [],
        menu: [],
        notifications: [],
        accounts: [],
      })),
      resetAll: () =>
        set(() => ({
          groups: [],
          children: [],
          staff: [],
          attendance: [],
          payments: [],
          expenses: [],
          extraIncome: [],
          schedule: [],
          menu: [],
          notifications: [],
          accounts: [],
        })),
    }),
    { name: 'kg_data_v4' },
  ),
)

