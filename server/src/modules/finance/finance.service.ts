import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

/**
 * Финансовая логика. Все ключевые отчёты идут через Redis-кэш (60 сек),
 * чтобы избежать тяжёлых SQL-агрегатов на каждый запрос дашборда.
 *
 * Формула прибыли группы:
 *   income(G,M)  = Σ payment.amount (paid)  + Σ extraIncome.amount (groupId=G, month=M)
 *   expenses(G,M)= direct + sharedProportional + fixedMonthlyExpense
 *   profit       = income - expenses
 *   margin       = profit / income     (если income > 0)
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Финансовая сводка по одной группе за месяц.
   * Все суммы возвращаем как number (Decimal → Number) — клиенту так удобнее.
   */
  async groupSummary(groupId: string, month: string) {
    const cacheKey = `finance:group:${groupId}:${month}`
    return this.redis.wrap(cacheKey, 60, async () => {
      // 1 round-trip: достаём всё нужное параллельно
      const [group, totalStudents, students, paymentsAgg, extraAgg, directExpAgg, sharedExpAgg] =
        await Promise.all([
          this.prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
          this.prisma.student.count({ where: { status: 'ACTIVE' } }),
          this.prisma.student.findMany({
            where: { groupId, status: 'ACTIVE' },
            select: { id: true },
          }),
          this.prisma.payment.aggregate({
            where: { month, paid: true, student: { groupId } },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          this.prisma.extraIncome.aggregate({
            where: { month, groupId },
            _sum: { amount: true },
          }),
          this.prisma.expense.aggregate({
            where: { month, groupId },
            _sum: { amount: true },
          }),
          this.prisma.expense.aggregate({
            where: { month, groupId: null },
            _sum: { amount: true },
          }),
        ])

      const studentsCount = students.length
      const income =
        Number(paymentsAgg._sum.amount ?? 0) + Number(extraAgg._sum.amount ?? 0)

      const direct = Number(directExpAgg._sum.amount ?? 0)
      const sharedTotal = Number(sharedExpAgg._sum.amount ?? 0)
      const sharedShare = totalStudents > 0
        ? sharedTotal * (studentsCount / totalStudents)
        : 0
      const expenses = direct + sharedShare + Number(group.fixedMonthlyExpense)

      // Должники
      const paidCount = paymentsAgg._count._all
      const debtorsCount = Math.max(0, studentsCount - paidCount)

      const profit = income - expenses
      const margin = income > 0 ? profit / income : 0

      return {
        groupId,
        month,
        studentsCount,
        paidCount,
        debtorsCount,
        income: Math.round(income),
        expenses: Math.round(expenses),
        profit: Math.round(profit),
        margin: Number(margin.toFixed(4)),
        isProfitable: profit >= 0,
      }
    })
  }

  /**
   * Глобальная сводка по всем группам за месяц.
   */
  async globalSummary(month: string) {
    const cacheKey = `finance:global:${month}`
    return this.redis.wrap(cacheKey, 60, async () => {
      const [paymentsAgg, extraAgg, expensesAgg, fixedAgg, salariesAgg, taxesAgg] =
        await Promise.all([
          this.prisma.payment.aggregate({ where: { month, paid: true }, _sum: { amount: true } }),
          this.prisma.extraIncome.aggregate({ where: { month }, _sum: { amount: true } }),
          this.prisma.expense.aggregate({ where: { month }, _sum: { amount: true } }),
          this.prisma.group.aggregate({ _sum: { fixedMonthlyExpense: true } }),
          this.prisma.expense.aggregate({
            where: { month, category: 'SALARIES' },
            _sum: { amount: true },
          }),
          this.prisma.expense.aggregate({
            where: { month, category: 'TAXES' },
            _sum: { amount: true },
          }),
        ])

      const totalIncome = Number(paymentsAgg._sum.amount ?? 0) + Number(extraAgg._sum.amount ?? 0)
      const totalExpenses = Number(expensesAgg._sum.amount ?? 0) + Number(fixedAgg._sum.fixedMonthlyExpense ?? 0)
      const netProfit = totalIncome - totalExpenses
      const margin = totalIncome > 0 ? netProfit / totalIncome : 0

      return {
        month,
        totalIncome: Math.round(totalIncome),
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round(netProfit),
        margin: Number(margin.toFixed(4)),
        salaries: Math.round(Number(salariesAgg._sum.amount ?? 0)),
        taxes: Math.round(Number(taxesAgg._sum.amount ?? 0)),
        isProfitable: netProfit >= 0,
      }
    })
  }

  // -------------------------------------------------------
  /** Инвалидация — на любую мутацию платежей/расходов. */
  async invalidate(month?: string, groupId?: string) {
    if (groupId && month) {
      await this.redis.del(`finance:group:${groupId}:${month}`)
    } else if (groupId) {
      await this.redis.delByPattern(`finance:group:${groupId}:*`)
    }
    if (month) await this.redis.del(`finance:global:${month}`)
    else await this.redis.delByPattern('finance:global:*')
  }
}
