import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { ExpenseCategory, Prisma } from '@prisma/client'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

interface CreateExpenseDto {
  category: ExpenseCategory
  description: string
  amount: number
  month: string
  groupId?: string | null
}

interface UpdateExpenseDto {
  category?: ExpenseCategory
  description?: string
  amount?: number
  month?: string
  groupId?: string | null
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список расходов садика (с фильтрами). */
  async findAll(
    user: AuthUser,
    params: {
      month?: string
      groupId?: string
      category?: ExpenseCategory
    },
  ) {
    const where: Prisma.ExpenseWhereInput = {
      ...(user.kindergartenId
        ? { kindergartenId: user.kindergartenId }
        : {}),
      ...(params.month ? { month: params.month } : {}),
      ...(params.groupId ? { groupId: params.groupId } : {}),
      ...(params.category ? { category: params.category } : {}),
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(user: AuthUser, dto: CreateExpenseDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    if (!dto.description?.trim()) {
      throw new BadRequestException('Описание обязательно')
    }
    if (!dto.month) {
      throw new BadRequestException('Месяц обязателен')
    }
    if (dto.amount == null || dto.amount < 0) {
      throw new BadRequestException('Сумма обязательна и >= 0')
    }

    // Если указана группа — проверить что она из того же садика
    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      })
      if (!group) throw new NotFoundException('Группа не найдена')
      if (group.kindergartenId !== user.kindergartenId) {
        throw new ForbiddenException('Группа из другого садика')
      }
    }

    return this.prisma.expense.create({
      data: {
        category: dto.category,
        description: dto.description.trim(),
        amount: dto.amount,
        month: dto.month,
        groupId: dto.groupId || null,
        kindergartenId: user.kindergartenId,
      },
      include: {
        group: { select: { id: true, name: true, color: true } },
      },
    })
  }

  async update(user: AuthUser, id: string, dto: UpdateExpenseDto) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Расход не найден')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Расход из другого садика')
    }

    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      })
      if (!group) throw new NotFoundException('Группа не найдена')
      if (
        user.kindergartenId &&
        group.kindergartenId !== user.kindergartenId
      ) {
        throw new ForbiddenException('Группа из другого садика')
      }
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description?.trim(),
        amount: dto.amount,
        month: dto.month,
        groupId: dto.groupId !== undefined ? (dto.groupId || null) : undefined,
      },
      include: {
        group: { select: { id: true, name: true, color: true } },
      },
    })
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Расход не найден')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Расход из другого садика')
    }
    await this.prisma.expense.delete({ where: { id } })
    return { success: true }
  }
}
