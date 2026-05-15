import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { FinanceService } from '../finance/finance.service'
import type { AuthUser } from '../../common/types/jwt-payload'

/**
 * Аналитика с фильтрацией по садику (multi-tenant).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly finance: FinanceService,
  ) {}

  async dashboard(user: AuthUser, month: string) {
    const tenantKey = user.kindergartenId || 'global'
    return this.redis.wrap(
      `analytics:dashboard:${tenantKey}:${month}`,
      60,
      async () => {
        const studentFilter = user.kindergartenId
          ? { kindergartenId: user.kindergartenId }
          : {}
        const groupFilter = user.kindergartenId
          ? { kindergartenId: user.kindergartenId }
          : {}

        const [global, activeStudents, totalStudents, groups] =
          await Promise.all([
            this.finance.globalSummary(user, month),
            this.prisma.student.count({
              where: { status: 'ACTIVE', ...studentFilter },
            }),
            this.prisma.student.count({ where: studentFilter }),
            this.prisma.group.count({
              where: { isActive: true, ...groupFilter },
            }),
          ])
        return { ...global, activeStudents, totalStudents, groups }
      },
    )
  }

  async profitability(user: AuthUser, month: string) {
    const tenantKey = user.kindergartenId || 'global'
    return this.redis.wrap(
      `analytics:profitability:${tenantKey}:${month}`,
      60,
      async () => {
        const groups = await this.prisma.group.findMany({
          where: {
            isActive: true,
            ...(user.kindergartenId
              ? { kindergartenId: user.kindergartenId }
              : {}),
          },
          select: { id: true, name: true, color: true },
        })
        const rows = await Promise.all(
          groups.map(async (g) => ({
            ...g,
            ...(await this.finance.groupSummary(user, g.id, month)),
          })),
        )
        const best = [...rows].sort((a, b) => b.profit - a.profit)[0] || null
        const worst = [...rows].sort((a, b) => a.profit - b.profit)[0] || null
        return { rows, best, worst }
      },
    )
  }

  async trend(user: AuthUser, monthsBack = 12) {
    const tenantKey = user.kindergartenId || 'global'
    return this.redis.wrap(
      `analytics:trend:${tenantKey}:${monthsBack}`,
      60,
      async () => {
        const arr: Array<{
          month: string
          income: number
          expenses: number
          profit: number
        }> = []
        for (let i = monthsBack - 1; i >= 0; i--) {
          const m = dayjs().subtract(i, 'month').format('YYYY-MM')
          const g = await this.finance.globalSummary(user, m)
          arr.push({
            month: m,
            income: g.totalIncome,
            expenses: g.totalExpenses,
            profit: g.netProfit,
          })
        }
        return arr
      },
    )
  }
}
