import dayjs from 'dayjs'
import {
  AttendanceRecord,
  Child,
  Expense,
  ExtraIncome,
  Group,
  GroupFinance,
  Payment,
} from '../types'

/* ============================================================
   Финансовая логика. Считаем доходы/расходы по каждой группе.

   Правила распределения:
   1. Доход группы = (сумма paid платежей за месяц у её детей)
                     + (extraIncome, привязанный к группе)
   2. Расход группы = (расходы Expense с groupId == group.id)
                       + доля от «общих расходов» пропорционально
                         количеству детей в группе.
                       + fixedMonthlyExpense группы (если задан)
   3. Прибыль = Доход – Расход. Margin = Прибыль / Доход (0..1).
   ============================================================ */

export interface FinanceInput {
  groups: Group[]
  children: Child[]
  payments: Payment[]
  expenses: Expense[]
  extraIncome: ExtraIncome[]
  attendance: AttendanceRecord[]
  month: string // YYYY-MM
}

export function calcGroupFinances(input: FinanceInput): GroupFinance[] {
  const { groups, children, payments, expenses, extraIncome, attendance, month } = input

  // Доли «общих расходов» распределяем пропорционально числу детей
  const childrenByGroup: Record<string, Child[]> = {}
  for (const g of groups) childrenByGroup[g.id] = []
  for (const c of children) {
    if (childrenByGroup[c.groupId]) childrenByGroup[c.groupId].push(c)
  }
  const totalKids = children.length || 1

  const commonExpense = expenses
    .filter((e) => e.month === month && !e.groupId)
    .reduce((sum, e) => sum + e.amount, 0)

  // Посещаемость: % presence у детей группы за выбранный месяц
  const monthStart = dayjs(month + '-01')
  const monthEnd = monthStart.endOf('month')

  return groups.map<GroupFinance>((g) => {
    const kids = childrenByGroup[g.id]
    const kidIds = new Set(kids.map((k) => k.id))

    const paidPayments = payments.filter(
      (p) => p.month === month && p.paid && kidIds.has(p.childId),
    )
    const totalPaid = paidPayments.reduce((s, p) => s + p.amount, 0)
    const extras = extraIncome
      .filter((e) => e.month === month && e.groupId === g.id)
      .reduce((s, e) => s + e.amount, 0)
    const income = totalPaid + extras

    const directExpenses = expenses
      .filter((e) => e.month === month && e.groupId === g.id)
      .reduce((s, e) => s + e.amount, 0)

    const proportionalCommon = commonExpense * (kids.length / totalKids)

    const expensesTotal = directExpenses + proportionalCommon + (g.fixedMonthlyExpense || 0)
    const profit = income - expensesTotal
    const margin = income > 0 ? profit / income : 0

    // Посещаемость
    const groupAttendance = attendance.filter((a) => {
      if (!kidIds.has(a.childId)) return false
      const d = dayjs(a.date)
      return d.isAfter(monthStart.subtract(1, 'day')) && d.isBefore(monthEnd.add(1, 'day'))
    })
    const present = groupAttendance.filter((a) => a.status === 'present').length
    const attendanceRate = groupAttendance.length > 0 ? present / groupAttendance.length : 0

    const paidIds = new Set(paidPayments.map((p) => p.childId))
    const paidCount = kids.filter((k) => paidIds.has(k.id)).length
    const debtorsCount = kids.length - paidCount

    return {
      group: g,
      childrenCount: kids.length,
      paidCount,
      debtorsCount,
      income: Math.round(isFinite(income) ? income : 0),
      expenses: Math.round(isFinite(expensesTotal) ? expensesTotal : 0),
      profit: Math.round(isFinite(profit) ? profit : 0),
      margin: isFinite(margin) ? margin : 0,
      attendanceRate: isFinite(attendanceRate) ? attendanceRate : 0,
    }
  })
}

/** Глобальные итоги по всему саду за месяц. */
export interface GlobalFinance {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  margin: number
  salaries: number
  taxes: number
  isProfitable: boolean
  bestGroup?: GroupFinance
  worstGroup?: GroupFinance
}

/** Безопасное число: NaN/Infinity -> 0, всё округляем до целого. */
const safe = (n: number) => (isFinite(n) && !isNaN(n) ? Math.round(n) : 0)

export function calcGlobalFinance(
  groupFinances: GroupFinance[],
  expenses: Expense[],
  month: string,
): GlobalFinance {
  const totalIncome = safe(groupFinances.reduce((s, g) => s + g.income, 0))
  // Расходы суммируем как Sum( expense ) фактических (без двойного учёта).
  const totalExpenses = safe(
    expenses.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0) +
      groupFinances.reduce((s, g) => s + (g.group.fixedMonthlyExpense || 0), 0),
  )
  const netProfit = safe(totalIncome - totalExpenses)
  const margin = totalIncome > 0 ? netProfit / totalIncome : 0

  const salaries = expenses
    .filter((e) => e.month === month && e.category === 'Зарплата сотрудников')
    .reduce((s, e) => s + e.amount, 0)
  const taxes = expenses
    .filter((e) => e.month === month && e.category === 'Налоги')
    .reduce((s, e) => s + e.amount, 0)

  const sorted = [...groupFinances].sort((a, b) => b.profit - a.profit)

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    margin,
    salaries,
    taxes,
    isProfitable: netProfit >= 0,
    bestGroup: sorted[0],
    worstGroup: sorted[sorted.length - 1],
  }
}

/** Серия по последним N месяцам для графиков. */
export function buildMonthlyTrend(
  monthsBack: number,
  build: (m: string) => { income: number; expenses: number },
) {
  const arr: { month: string; income: number; expenses: number; profit: number }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const m = dayjs().subtract(i, 'month').format('YYYY-MM')
    const r = build(m)
    arr.push({ month: m, income: r.income, expenses: r.expenses, profit: r.income - r.expenses })
  }
  return arr
}
