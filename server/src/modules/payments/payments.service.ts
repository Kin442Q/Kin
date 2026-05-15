import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PaymentMethod, Prisma } from '@prisma/client'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { TelegramLinkService } from '../telegram/telegram-link.service'
import type { AuthUser } from '../../common/types/jwt-payload'

interface UpsertPaymentDto {
  studentId: string
  month: string
  amount: number
  paid: boolean
  method?: PaymentMethod
  comment?: string
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramLinkService,
  ) {}

  /**
   * Список платежей за месяц. Учитель видит только свою группу.
   */
  async findAll(
    user: AuthUser,
    params: { month?: string; groupId?: string },
  ) {
    const studentFilter: Prisma.StudentWhereInput = {}
    if (user.kindergartenId) {
      studentFilter.kindergartenId = user.kindergartenId
    }
    if (user.role === 'TEACHER') {
      if (!user.groupId) return []
      studentFilter.groupId = user.groupId
    } else if (params.groupId) {
      studentFilter.groupId = params.groupId
    }

    const where: Prisma.PaymentWhereInput = {
      ...(params.month ? { month: params.month } : {}),
      student: studentFilter,
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            groupId: true,
            motherPhone: true,
            fatherPhone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Создать или обновить платёж по [studentId, month].
   * При установке paid:true автоматически шлёт Telegram-уведомление.
   */
  async upsert(user: AuthUser, dto: UpsertPaymentDto) {
    if (!dto.studentId) throw new BadRequestException('studentId обязателен')
    if (!dto.month) throw new BadRequestException('month обязателен')

    // Проверяем что ребёнок из того же садика
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      include: { group: true },
    })
    if (!student) throw new NotFoundException('Ребёнок не найден')
    if (
      user.kindergartenId &&
      student.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Ребёнок из другого садика')
    }
    if (user.role === 'TEACHER' && student.groupId !== user.groupId) {
      throw new ForbiddenException('Ребёнок не из вашей группы')
    }

    // Проверяем предыдущее состояние, чтобы понять — это переход в paid
    const previous = await this.prisma.payment.findUnique({
      where: {
        studentId_month: { studentId: dto.studentId, month: dto.month },
      },
    })

    const becamePaid = dto.paid && (!previous || !previous.paid)

    const payment = await this.prisma.payment.upsert({
      where: {
        studentId_month: { studentId: dto.studentId, month: dto.month },
      },
      update: {
        amount: dto.amount,
        paid: dto.paid,
        paidAt: dto.paid ? new Date() : null,
        method: dto.method ?? null,
        comment: dto.comment ?? null,
      },
      create: {
        studentId: dto.studentId,
        month: dto.month,
        amount: dto.amount,
        paid: dto.paid,
        paidAt: dto.paid ? new Date() : null,
        method: dto.method ?? null,
        comment: dto.comment ?? null,
      },
    })

    // При переходе "не оплачено → оплачено" шлём уведомление родителям
    if (becamePaid) {
      this.notifyPaid(student, dto.month, dto.amount).catch((e) => {
        this.logger.error(
          `[payments] notifyPaid failed: ${e?.message || e}`,
        )
      })
    }

    return payment
  }

  async remove(user: AuthUser, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { student: true },
    })
    if (!payment) throw new NotFoundException('Платёж не найден')
    if (
      user.kindergartenId &&
      payment.student.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Платёж из другого садика')
    }
    if (user.role === 'TEACHER' && payment.student.groupId !== user.groupId) {
      throw new ForbiddenException('Ребёнок не из вашей группы')
    }
    await this.prisma.payment.delete({ where: { id } })
    return { success: true }
  }

  // ----------------------------------------------------------------
  // Notification helpers
  // ----------------------------------------------------------------

  private async notifyPaid(
    student: {
      id: string
      firstName: string
      lastName: string
      group?: { name: string } | null
      motherPhone: string | null
      fatherPhone: string | null
    },
    month: string,
    amount: number,
  ) {
    const phones = [student.motherPhone, student.fatherPhone].filter(
      Boolean,
    ) as string[]

    if (phones.length === 0) {
      this.logger.log(
        `[payments] notifyPaid: у ребёнка ${student.id} нет телефонов`,
      )
      return
    }

    await this.telegram.sendPaymentConfirmation({
      phones,
      studentName: `${student.firstName} ${student.lastName}`,
      groupName: student.group?.name,
      amount,
      paid: true,
      month,
    })
  }
}
