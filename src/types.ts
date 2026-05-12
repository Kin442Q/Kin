/* ============================================================
   Доменные типы. Используются и фронтом, и (как контракт) бэком.
   ============================================================ */

// --- Роли пользователей --------------------------------------
export type Role = 'super_admin' | 'admin' | 'teacher' | 'parent'

export interface User {
  id: string
  fullName: string
  email: string
  role: Role
  avatarUrl?: string
  /** Для роли teacher — id назначенной группы */
  groupId?: string
  /** Для роли parent — id ребёнка */
  childId?: string
}

/**
 * Учётная запись. Хранит пароль (в демо — открытым текстом;
 * в реальном backend это будет bcrypt-хеш).
 * Все созданные через интерфейс учителя/админы лежат именно здесь.
 */
export interface Account {
  id: string
  email: string
  password: string
  fullName: string
  role: Role
  /** Для teacher — id привязанной группы */
  groupId?: string
  phone?: string
  avatarUrl?: string
  createdAt: string
}

// --- Группы --------------------------------------------------
export interface Group {
  id: string
  name: string
  /** Возрастная категория, например "3–4 года" */
  ageRange: string
  /** Фиксированная ежемесячная плата за ребёнка в этой группе */
  monthlyFee: number
  /** id воспитателя (Staff) */
  teacherId?: string
  /** Месячные «локальные» расходы группы, помимо зарплаты воспитателя
   *  (питание, материалы, доля от аренды и т.п.) */
  fixedMonthlyExpense: number
  /** Цвет для UI и диаграмм */
  color: string
  createdAt: string
}

// Совместимость со старыми компонентами, которые могут импортировать GroupName.
// Реальные данные приходят из стора по id.
export type GroupName = string
export const GROUPS: string[] = []

// --- Дети ----------------------------------------------------
export type Gender = 'male' | 'female'

export interface Child {
  id: string
  firstName: string
  lastName: string
  middleName?: string
  birthDate: string // ISO YYYY-MM-DD
  gender: Gender
  groupId: string
  photoUrl?: string
  medicalNotes?: string
  notes?: string
  // Информация о родителях
  motherName?: string
  motherPhone?: string
  fatherName?: string
  fatherPhone?: string
  address?: string
  extraContact?: string
  telegram?: string
  whatsapp?: string
  /** Опциональная индивидуальная плата (иначе берётся плата группы) */
  monthlyFee?: number
  createdAt: string
}

// --- Сотрудники ----------------------------------------------
export const POSITIONS = [
  'Воспитатель',
  'Помощник воспитателя',
  'Заведующий',
  'Методист',
  'Медсестра',
  'Повар',
  'Психолог',
  'Музыкальный руководитель',
  'Охранник',
  'Уборщик',
] as const
export type Position = (typeof POSITIONS)[number]

export interface Staff {
  id: string
  firstName: string
  lastName: string
  middleName?: string
  position: Position
  phone: string
  email?: string
  groupId?: string
  salary: number
  hireDate: string
  createdAt: string
}

// --- Посещаемость --------------------------------------------
export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'vacation'

export interface AttendanceRecord {
  id: string
  childId: string
  date: string // YYYY-MM-DD
  status: AttendanceStatus
  note?: string
}

// --- Платежи -------------------------------------------------
export interface Payment {
  id: string
  childId: string
  month: string // YYYY-MM
  amount: number
  paid: boolean
  paidAt?: string
  method?: 'cash' | 'card' | 'transfer'
  comment?: string
  createdAt: string
}

// --- Расходы -------------------------------------------------
export const EXPENSE_CATEGORIES = [
  'Зарплата сотрудников',
  'Налоги',
  'Аренда помещения',
  'Коммунальные услуги',
  'Питание',
  'Игрушки и инвентарь',
  'Учебные материалы',
  'Канцелярия',
  'Интернет и связь',
  'Уборка и хозтовары',
  'Ремонт и обслуживание',
  'Прочее',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  month: string // YYYY-MM
  groupId?: string // если расход относится к конкретной группе
  createdAt: string
}

// --- Расписание / меню --------------------------------------
export interface ScheduleItem {
  id: string
  groupId: string
  dayOfWeek: number // 1..7
  startTime: string
  endTime: string
  activity: string
}

export type MealType = 'Завтрак' | 'Обед' | 'Полдник' | 'Ужин'
export interface MenuItem {
  id: string
  date: string
  mealType: MealType
  dishes: string
}

// --- Доп. услуги (доход) ------------------------------------
export interface ExtraIncome {
  id: string
  title: string
  amount: number
  month: string // YYYY-MM
  groupId?: string
  comment?: string
  createdAt: string
}

// --- Уведомления / лог --------------------------------------
export interface AppNotification {
  id: string
  title: string
  description?: string
  type: 'info' | 'success' | 'warning' | 'error'
  createdAt: string
  read: boolean
}

// --- Глобальный денежный отчёт ------------------------------
export interface GroupFinance {
  group: Group
  childrenCount: number
  paidCount: number
  debtorsCount: number
  income: number
  expenses: number
  profit: number
  margin: number // profit / income (если income>0)
  attendanceRate: number // 0..1
}
