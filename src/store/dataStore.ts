import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import dayjs from 'dayjs'
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

      seedDemo: () => set(() => buildSeed()),
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

/* ------------------------------------------------------------
   Демо-данные. Реалистичные цифры, чтобы дашборд сразу впечатлял.
   ------------------------------------------------------------ */
function buildSeed(): Partial<DataState> & {
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
} {
  const now = new Date().toISOString()
  const month = dayjs().format('YYYY-MM')


  const children: Child[] = []
  const payments: Payment[] = []
  const attendance: AttendanceRecord[] = []

  let ix = 0
  for (const g of groups) {
    const count = childrenPerGroup[g.id] ?? 12
    for (let i = 0; i < count; i++) {
      const isFemale = (ix + i) % 2 === 0
      const fn = (isFemale ? firstNamesF : firstNamesM)[(ix + i) % 10]
      const ln = lastNames[(ix + i + 3) % 10]
      const id = `c-${g.id}-${i + 1}`
      const birthYear = 2026 - parseInt(g.ageRange) // ориентировочно
      const birthDate = dayjs(`${birthYear}-${((i % 12) + 1).toString().padStart(2, '0')}-15`).format('YYYY-MM-DD')

      const fee = g.monthlyFee
      const child: Child = {
        id,
        firstName: fn,
        lastName: ln + (isFemale ? 'а' : ''),
        birthDate,
        gender: isFemale ? 'female' : 'male',
        groupId: g.id,
        motherName: 'Мама ' + fn,
        motherPhone: '+992 90 100 0' + (10 + ix + i),
        fatherName: 'Папа ' + fn,
        fatherPhone: '+992 91 200 0' + (10 + ix + i),
        address: 'г. Душанбе, ул. Рудаки, д. ' + ((ix + i) % 200),
        monthlyFee: fee,
        createdAt: now,
      }
      children.push(child)

      // Платежи: ~80% оплатили
      const paid = i % 5 !== 0
      payments.push({
        id: `p-${id}`,
        childId: id,
        month,
        amount: fee,
        paid,
        paidAt: paid ? dayjs().subtract(i % 10, 'day').toISOString() : undefined,
        method: paid ? (i % 3 === 0 ? 'card' : i % 3 === 1 ? 'cash' : 'transfer') : undefined,
        createdAt: now,
      })

      // Посещаемость: ~85% присутствуют сегодня
      attendance.push({
        id: `a-${id}-${dayjs().format('YYYY-MM-DD')}`,
        childId: id,
        date: dayjs().format('YYYY-MM-DD'),
        status: i % 7 === 0 ? 'absent' : i % 11 === 0 ? 'sick' : 'present',
      })
    }
    ix += count
  }

  // Расходы текущего месяца
  const expenses: Expense[] = [
    // Зарплаты воспитателей привязаны к группам
    { id: 'e-1', category: 'Зарплата сотрудников', description: 'З/п воспитателя Солнышко', amount: 3500, month, groupId: 'g-sun', createdAt: now },
    { id: 'e-2', category: 'Зарплата сотрудников', description: 'З/п воспитателя Звёздочка', amount: 3600, month, groupId: 'g-star', createdAt: now },
    { id: 'e-3', category: 'Зарплата сотрудников', description: 'З/п воспитателя Радуга', amount: 3800, month, groupId: 'g-rain', createdAt: now },
    { id: 'e-4', category: 'Зарплата сотрудников', description: 'З/п воспитателя Цветочек', amount: 3400, month, groupId: 'g-flower', createdAt: now },
    // Общие расходы
    { id: 'e-5', category: 'Зарплата сотрудников', description: 'З/п заведующего, повара, медсестры', amount: 11300, month, createdAt: now },
    { id: 'e-6', category: 'Аренда помещения', description: 'Аренда здания', amount: 9000, month, createdAt: now },
    { id: 'e-7', category: 'Коммунальные услуги', description: 'Электричество, вода, газ', amount: 2200, month, createdAt: now },
    { id: 'e-8', category: 'Питание', description: 'Закупка продуктов', amount: 6800, month, createdAt: now },
    { id: 'e-9', category: 'Игрушки и инвентарь', description: 'Новые игрушки и материалы', amount: 1500, month, createdAt: now },
    { id: 'e-10', category: 'Налоги', description: 'Налог на прибыль и соц.отчисления', amount: 4200, month, createdAt: now },
    { id: 'e-11', category: 'Интернет и связь', description: 'Интернет и телефония', amount: 350, month, createdAt: now },
    { id: 'e-12', category: 'Канцелярия', description: 'Канцелярия и материалы', amount: 600, month, createdAt: now },
  ]

  const extraIncome: ExtraIncome[] = [
    { id: 'ei-1', title: 'Кружок «Английский»', amount: 1800, month, comment: 'Доп. занятия', createdAt: now },
    { id: 'ei-2', title: 'Танцы', amount: 1200, month, createdAt: now },
    { id: 'ei-3', title: 'Утренник (платный концерт)', amount: 900, month, createdAt: now },
  ]

  const notifications: AppNotification[] = [
    { id: 'n-1', title: 'Поступила оплата', description: 'Платёж за ребёнка зачислен', type: 'success', createdAt: now, read: false },
    { id: 'n-2', title: '3 родителя не оплатили', description: 'Группа «Солнышко» — должники', type: 'warning', createdAt: now, read: false },
    { id: 'n-3', title: 'Новый ребёнок', description: 'Добавлен в группу «Радуга»', type: 'info', createdAt: now, read: true },
  ]

  // --- Стартовые учётки ---
  // Админы — для системы. Учителя ниже привязаны к своим группам.
  const accounts: Account[] = [
    { id: 'acc-super',  email: 'super@kg.app',  password: 'demo', fullName: 'Super Admin',  role: 'super_admin', createdAt: now },
    { id: 'acc-admin',  email: 'admin@kg.app',  password: 'demo', fullName: 'Администратор', role: 'admin',     createdAt: now },
    { id: 'acc-t-sun',    email: 'zarina@kg.app',  password: 'demo', fullName: 'Зарина Аминова',   role: 'teacher', groupId: 'g-sun',    phone: '+992 90 111 22 33', createdAt: now },
    { id: 'acc-t-star',   email: 'madina@kg.app',  password: 'demo', fullName: 'Мадина Каримова',  role: 'teacher', groupId: 'g-star',   phone: '+992 91 222 33 44', createdAt: now },
    { id: 'acc-t-rain',   email: 'shahnoza@kg.app',password: 'demo', fullName: 'Шахноза Турсунова',role: 'teacher', groupId: 'g-rain',   phone: '+992 92 333 44 55', createdAt: now },
    { id: 'acc-t-flower', email: 'gulnora@kg.app', password: 'demo', fullName: 'Гулнора Назарова', role: 'teacher', groupId: 'g-flower', phone: '+992 93 444 55 66', createdAt: now },
    { id: 'acc-parent', email: 'parent@kg.app', password: 'demo', fullName: 'Родитель',       role: 'parent',    createdAt: now },
  ]

  return {
    groups,
    staff,
    children,
    payments,
    attendance,
    expenses,
    extraIncome,
    schedule: [],
    menu: [],
    notifications,
    accounts,
  }
}
