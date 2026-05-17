import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { Prisma, TimeVerifyMethod, SalaryMode } from '@prisma/client'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

interface CheckInDto {
  verifyMethod?: TimeVerifyMethod
  note?: string
}

interface CheckOutDto {
  note?: string
}

interface UpdateEntryDto {
  checkIn?: string
  checkOut?: string
  note?: string
}

interface SetSalaryDto {
  salaryMode?: SalaryMode
  hourlyRate?: number | null
  monthlySalaryFixed?: number | null
  workNorm?: number
}

@Injectable()
export class TimeTrackingService {
  private readonly logger = new Logger(TimeTrackingService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ─── Учитель: check-in / check-out ─────────────────────────────────

  /**
   * Старт рабочего дня. Если есть незакрытая запись — конфликт.
   */
  async checkIn(user: AuthUser, dto: CheckInDto) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { userId: user.sub, checkOut: null },
    })
    if (open) {
      throw new ConflictException(
        'Уже есть открытая смена — сначала отметьте уход',
      )
    }

    const now = new Date()
    const date = startOfDay(now)

    return this.prisma.timeEntry.create({
      data: {
        userId: user.sub,
        date,
        checkIn: now,
        verifyMethod: dto.verifyMethod ?? 'MANUAL',
        note: dto.note ?? null,
      },
    })
  }

  /**
   * Конец рабочего дня. Закрывает последнюю открытую смену, вычисляет минуты.
   */
  async checkOut(user: AuthUser, dto: CheckOutDto) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { userId: user.sub, checkOut: null },
      orderBy: { checkIn: 'desc' },
    })
    if (!open) {
      throw new NotFoundException('Нет открытой смены — сначала отметьте приход')
    }

    const now = new Date()
    const minutes = Math.max(
      0,
      Math.floor((now.getTime() - open.checkIn.getTime()) / 60000),
    )

    return this.prisma.timeEntry.update({
      where: { id: open.id },
      data: {
        checkOut: now,
        minutesWorked: minutes,
        note: dto.note ?? open.note,
      },
    })
  }

  /**
   * Текущее состояние смены (открыта или нет).
   */
  async myStatus(user: AuthUser) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { userId: user.sub, checkOut: null },
      orderBy: { checkIn: 'desc' },
    })
    return {
      isWorking: !!open,
      activeEntry: open,
    }
  }

  // ─── Сводка за месяц ───────────────────────────────────────────────

  /**
   * Личная сводка учителя за месяц: записи, всего минут, плановая зарплата.
   */
  async myMonth(user: AuthUser, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month должен быть в формате YYYY-MM')
    }
    return this.computeMonthForUser(user.sub, month)
  }

  /**
   * Админская сводка по всем учителям садика за месяц.
   */
  async allTeachersMonth(user: AuthUser, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month должен быть в формате YYYY-MM')
    }

    const teachers = await this.prisma.user.findMany({
      where: {
        role: 'TEACHER',
        isActive: true,
        ...(user.kindergartenId
          ? { kindergartenId: user.kindergartenId }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        groupId: true,
        salaryMode: true,
        hourlyRate: true,
        monthlySalaryFixed: true,
        workNorm: true,
      },
    })

    const results = await Promise.all(
      teachers.map(async (t) => {
        const summary = await this.computeMonthForUser(t.id, month)
        return {
          teacher: t,
          ...summary,
        }
      }),
    )

    return results
  }

  /**
   * Внутренняя функция: считает за месяц.
   */
  private async computeMonthForUser(userId: string, month: string) {
    const { from, to } = monthRange(month)

    const [entries, user] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: {
          userId,
          date: { gte: from, lt: to },
        },
        orderBy: { checkIn: 'asc' },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          salaryMode: true,
          hourlyRate: true,
          monthlySalaryFixed: true,
          workNorm: true,
        },
      }),
    ])

    const totalMinutes = entries.reduce(
      (sum, e) => sum + (e.minutesWorked ?? 0),
      0,
    )
    const totalHours = totalMinutes / 60

    const hourlyRate = Number(user?.hourlyRate ?? 0)
    const fixedSalary = Number(user?.monthlySalaryFixed ?? 0)
    const workNorm = user?.workNorm ?? 176

    let estimatedSalary = 0
    if (user?.salaryMode === 'HOURLY') {
      estimatedSalary = totalHours * hourlyRate
    } else {
      // FIXED: пропорция от нормы + бонус за переработки по часовой ставке
      const baseShare = Math.min(1, totalHours / workNorm)
      const base = fixedSalary * baseShare
      const overtime = Math.max(0, totalHours - workNorm)
      const overtimeBonus = overtime * (hourlyRate || fixedSalary / workNorm)
      estimatedSalary = base + overtimeBonus
    }

    return {
      month,
      entries,
      totalMinutes,
      totalHours: Math.round(totalHours * 100) / 100,
      workNorm,
      salaryMode: user?.salaryMode ?? 'HOURLY',
      hourlyRate,
      fixedSalary,
      estimatedSalary: Math.round(estimatedSalary * 100) / 100,
      completionRate: Math.min(1, totalHours / workNorm),
    }
  }

  // ─── Админ: ручная коррекция ───────────────────────────────────────

  async updateEntry(user: AuthUser, id: string, dto: UpdateEntryDto) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Только админ может править записи')
    }

    const existing = await this.prisma.timeEntry.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Запись не найдена')

    const data: Prisma.TimeEntryUpdateInput = {
      editedByAdminId: user.sub,
    }
    if (dto.checkIn) data.checkIn = new Date(dto.checkIn)
    if (dto.checkOut !== undefined) {
      data.checkOut = dto.checkOut ? new Date(dto.checkOut) : null
    }
    if (dto.note !== undefined) data.note = dto.note

    // Пересчёт minutesWorked
    const newCheckIn = dto.checkIn ? new Date(dto.checkIn) : existing.checkIn
    const newCheckOut =
      dto.checkOut !== undefined
        ? dto.checkOut
          ? new Date(dto.checkOut)
          : null
        : existing.checkOut

    if (newCheckOut) {
      data.minutesWorked = Math.max(
        0,
        Math.floor((newCheckOut.getTime() - newCheckIn.getTime()) / 60000),
      )
    } else {
      data.minutesWorked = null
    }

    return this.prisma.timeEntry.update({ where: { id }, data })
  }

  async deleteEntry(user: AuthUser, id: string) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Только админ может удалять записи')
    }
    const existing = await this.prisma.timeEntry.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Запись не найдена')
    await this.prisma.timeEntry.delete({ where: { id } })
    return { success: true }
  }

  // ─── Зарплатные настройки учителя ──────────────────────────────────

  /**
   * Установить параметры зарплаты для учителя (только админ).
   */
  async setTeacherSalary(user: AuthUser, teacherId: string, dto: SetSalaryDto) {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Только админ может менять ставки')
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    })
    if (!teacher) throw new NotFoundException('Учитель не найден')
    if (teacher.role !== 'TEACHER') {
      throw new BadRequestException('Этот пользователь не учитель')
    }

    return this.prisma.user.update({
      where: { id: teacherId },
      data: {
        ...(dto.salaryMode !== undefined && { salaryMode: dto.salaryMode }),
        ...(dto.hourlyRate !== undefined && {
          hourlyRate: dto.hourlyRate as any,
        }),
        ...(dto.monthlySalaryFixed !== undefined && {
          monthlySalaryFixed: dto.monthlySalaryFixed as any,
        }),
        ...(dto.workNorm !== undefined && { workNorm: dto.workNorm }),
      },
      select: {
        id: true,
        fullName: true,
        salaryMode: true,
        hourlyRate: true,
        monthlySalaryFixed: true,
        workNorm: true,
      },
    })
  }

  // ─── Face ID ───────────────────────────────────────────────────────

  /**
   * Сохранить биометрический дескриптор лица для текущего пользователя.
   * Дескриптор = Float32Array длины 128 от face-api.js на фронте.
   */
  async setMyFace(user: AuthUser, descriptor: number[]) {
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      throw new BadRequestException(
        'descriptor должен быть массивом из 128 чисел',
      )
    }
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { faceDescriptor: descriptor as any },
    })
    return { success: true }
  }

  async getMyFace(user: AuthUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { faceDescriptor: true },
    })
    return { hasFace: !!u?.faceDescriptor, descriptor: u?.faceDescriptor }
  }

  // ─── Демо-данные для тестирования (идемпотентно) ───────────────────

  /**
   * Создать или обновить демо-учителей (4 шт.) для тестирования.
   * Идемпотентно: создаёт если нет, обновляет если есть.
   * Параметры: phone (для логина), terminalCode, HOURLY ставка.
   */
  async setupDemoTeachers(user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Только SUPER_ADMIN')
    }

    // Найти или создать садик
    let kindergarten = await this.prisma.kindergarten.findFirst({
      where: { slug: 'default' },
    })
    if (!kindergarten) {
      kindergarten = await this.prisma.kindergarten.create({
        data: {
          slug: 'default',
          name: 'Мой Детский Сад',
          address: 'Душанбе',
          isActive: true,
        },
      })
    }

    // Дефолтный пароль для всех демо-учителей: Teacher123456!
    // bcrypt hash сгенерирован локально через bcryptjs.hashSync('Teacher123456!', 10)
    const pwHash =
      '$2a$10$FTdp1BbC0zm99qtg4zJeMe8UseHt3RNuWcr2PLVQyVOu7.QSv9ju.'

    const teachers = [
      {
        email: 'teacher1@kindergarten.tj',
        phone: '+992901111111',
        fullName: 'Зарина Аминова',
        code: 'T001',
        rate: 45,
      },
      {
        email: 'teacher2@kindergarten.tj',
        phone: '+992902222222',
        fullName: 'Мадина Каримова',
        code: 'T002',
        rate: 50,
      },
      {
        email: 'teacher3@kindergarten.tj',
        phone: '+992903333333',
        fullName: 'Шахноза Турсунова',
        code: 'T003',
        rate: 55,
      },
      {
        email: 'teacher4@kindergarten.tj',
        phone: '+992904444444',
        fullName: 'Гулнора Назарова',
        code: 'T004',
        rate: 50,
      },
    ]

    const results: Array<{ email: string; phone: string; action: string }> = []

    for (const t of teachers) {
      const existing = await this.prisma.user.findUnique({
        where: { email: t.email },
      })

      if (existing) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            phone: t.phone,
            terminalCode: t.code,
            salaryMode: 'HOURLY',
            hourlyRate: t.rate as any,
            workNorm: 176,
            kindergartenId: kindergarten.id,
            isActive: true,
          },
        })
        results.push({ email: t.email, phone: t.phone, action: 'updated' })
      } else {
        await this.prisma.user.create({
          data: {
            email: t.email,
            phone: t.phone,
            passwordHash: pwHash,
            fullName: t.fullName,
            role: 'TEACHER',
            isActive: true,
            kindergartenId: kindergarten.id,
            terminalCode: t.code,
            salaryMode: 'HOURLY',
            hourlyRate: t.rate as any,
            workNorm: 176,
          },
        })
        results.push({ email: t.email, phone: t.phone, action: 'created' })
      }
    }

    this.logger.log(`[demo] setup teachers: ${JSON.stringify(results)}`)
    return {
      success: true,
      kindergartenId: kindergarten.id,
      password: 'Teacher123456!',
      results,
    }
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const result = new Date(d)
  result.setHours(0, 0, 0, 0)
  return result
}

function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map(Number)
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1)) // следующий месяц
  return { from, to }
}
