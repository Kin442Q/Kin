import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { FinanceService } from '../finance/finance.service'

/**
 * Аналитика. Стратегия:
 *   - все ответы заворачиваем в Redis-кэш на 60 сек,
 *   - тренды считаем циклом по последним 12 месяцам, переиспользуя
 *     finance.globalSummary() (тоже кэшированный).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly finance: FinanceService,
  ) {}

  async dashboard(month: string) {
    return this.redis.wrap(`analytics:dashboard:${month}`, 60, async () => {
      const [global, activeStudents, totalStudents, groups] = await Promise.all([
        this.finance.globalSummary(month),
        this.prisma.student.count({ where: { status: 'ACTIVE' } }),
        this.prisma.student.count(),
        this.prisma.group.count({ where: { isActive: true } }),
      ])
      return { ...global, activeStudents, totalStudents, groups }
    })
  }

  async profitability(month: string) {
    return this.redis.wrap(`analytics:profitability:${month}`, 60, async () => {
      const groups = await this.prisma.group.findMany({
        where: { isActive: true },
        select: { id: true, name: true, color: true },
      })
      const rows = await Promise.all(
        groups.map(async (g) => ({
          ...g,
          ...(await this.finance.groupSummary(g.id, month)),
        })),
      )
      const best = [...rows].sort((a, b) => b.profit - a.profit)[0]
      const worst = [...rows].sort((a, b) => a.profit - b.profit)[0]
      return { rows, best, worst }
    })
  }

  async trend(monthsBack = 12) {
    return this.redis.wrap(`analytics:trend:${monthsBack}`, 60, async () => {
      const arr: Array<{ month: string; income: number; expenses: number; profit: number }> = []
      for (let i = monthsBack - 1; i >= 0; i--) {
        const m = dayjs().subtract(i, 'month').format('YYYY-MM')
        const g = await this.finance.globalSummary(m)
        arr.push({ month: m, income: g.totalIncome, expenses: g.totalExpenses, profit: g.netProfit })
      }
      return arr
    })
  }
}
