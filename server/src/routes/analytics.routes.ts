import { Router } from 'express'
import { prisma } from '../db'
import { authMiddleware, requireRole } from '../middleware/auth'

export const analyticsRouter = Router()
analyticsRouter.use(authMiddleware, requireRole('SUPER_ADMIN', 'ADMIN'))

/**
 * /api/analytics/summary?month=YYYY-MM
 * Возвращает глобальные итоги: доход, расход, прибыль, маржу.
 */
analyticsRouter.get('/summary', async (req, res, next) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)

    const [payments, expenses, extra, groups] = await Promise.all([
      prisma.payment.findMany({ where: { month, paid: true } }),
      prisma.expense.findMany({ where: { month } }),
      prisma.extraIncome.findMany({ where: { month } }),
      prisma.group.findMany(),
    ])

    const incomeFromFees = payments.reduce((s, p) => s + p.amount, 0)
    const extraIncome = extra.reduce((s, e) => s + e.amount, 0)
    const totalIncome = incomeFromFees + extraIncome
    const totalExpenses =
      expenses.reduce((s, e) => s + e.amount, 0) +
      groups.reduce((s, g) => s + (g.fixedMonthlyExpense || 0), 0)
    const netProfit = totalIncome - totalExpenses
    const margin = totalIncome > 0 ? netProfit / totalIncome : 0
    const salaries = expenses
      .filter((e) => e.category === 'Зарплата сотрудников')
      .reduce((s, e) => s + e.amount, 0)
    const taxes = expenses
      .filter((e) => e.category === 'Налоги')
      .reduce((s, e) => s + e.amount, 0)

    res.json({
      month,
      totalIncome,
      totalExpenses,
      netProfit,
      margin,
      salaries,
      taxes,
      isProfitable: netProfit >= 0,
    })
  } catch (e) { next(e) }
})
