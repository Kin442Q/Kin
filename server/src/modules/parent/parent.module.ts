import {
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

/** Prisma Decimal/строка/число → чистый number. */
function num(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const n = Number(String(v))
  return Number.isFinite(n) ? n : 0
}

/** Нормализует amount у платежа. */
function normPayment<T extends { amount: unknown } | null>(p: T): T {
  if (!p) return p
  return { ...p, amount: num((p as { amount: unknown }).amount) } as T
}

/**
 * Парент-API: единая точка доступа для мобильного приложения родителя.
 * Все эндпоинты строго ограничены ребёнком, привязанным к текущему пользователю
 * (через User.childId или Student.parents[]).
 */
@Injectable()
class ParentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список детей текущего родителя (childId + many-to-many parents). */
  async myKids(user: AuthUser) {
    return this.prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { id: user.childId ?? '__none__' },
          { parents: { some: { id: user.sub } } },
        ],
      },
      include: {
        group: {
          select: { id: true, name: true, color: true, ageRange: true },
        },
      },
      orderBy: [{ firstName: 'asc' }],
    })
  }

  private async ensureKidAccess(user: AuthUser, kidId: string) {
    const kid = await this.prisma.student.findFirst({
      where: {
        id: kidId,
        OR: [
          { id: user.childId ?? '__none__' },
          { parents: { some: { id: user.sub } } },
        ],
      },
      include: {
        group: {
          select: { id: true, name: true, color: true, ageRange: true },
        },
      },
    })
    if (!kid) throw new ForbiddenException('Нет доступа к этому ребёнку')
    return kid
  }

  async kidSchedule(user: AuthUser, kidId: string) {
    const kid = await this.ensureKidAccess(user, kidId)
    return this.prisma.scheduleItem.findMany({
      where: { groupId: kid.groupId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
  }

  async kidAttendance(
    user: AuthUser,
    kidId: string,
    from: string,
    to: string,
  ) {
    await this.ensureKidAccess(user, kidId)
    return this.prisma.attendance.findMany({
      where: {
        studentId: kidId,
        date: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { date: 'desc' },
    })
  }

  async kidPayments(user: AuthUser, kidId: string) {
    await this.ensureKidAccess(user, kidId)
    const list = await this.prisma.payment.findMany({
      where: { studentId: kidId },
      orderBy: [{ month: 'desc' }],
    })
    return list.map((p) => normPayment(p))
  }

  async kidGrades(
    user: AuthUser,
    kidId: string,
    from?: string,
    to?: string,
  ) {
    await this.ensureKidAccess(user, kidId)
    return this.prisma.grade.findMany({
      where: {
        studentId: kidId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        subject: { select: { id: true, name: true, color: true } },
        author: { select: { id: true, fullName: true } },
      },
    })
  }

  async kidGradeStats(user: AuthUser, kidId: string, from?: string, to?: string) {
    await this.ensureKidAccess(user, kidId)
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId: kidId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      select: { subjectId: true, value: true, subject: true },
    })
    const map: Record<
      string,
      { subjectId: string; name: string; color: string; count: number; sum: number }
    > = {}
    for (const g of grades) {
      const m =
        map[g.subjectId] ||
        (map[g.subjectId] = {
          subjectId: g.subjectId,
          name: g.subject.name,
          color: g.subject.color,
          count: 0,
          sum: 0,
        })
      m.count++
      m.sum += g.value
    }
    return Object.values(map).map((m) => ({
      ...m,
      average: m.count ? Number((m.sum / m.count).toFixed(2)) : 0,
    }))
  }

  async kidHomework(user: AuthUser, kidId: string) {
    const kid = await this.ensureKidAccess(user, kidId)
    return this.prisma.homework.findMany({
      where: { groupId: kid.groupId },
      orderBy: { dueDate: 'asc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
      },
    })
  }

  /** Сводка для главного экрана: ребёнок + статус на сегодня + следующее занятие + дневник. */
  async kidToday(user: AuthUser, kidId: string) {
    const kid = await this.ensureKidAccess(user, kidId)

    // ВАЖНО: посещаемость/дневник/заметки хранятся как new Date("YYYY-MM-DD")
    // = полночь UTC календарной даты. Раньше тут была локальная полночь
    // (setHours), из-за TZ=Asia/Dushanbe она на 5ч раньше → exact-match не
    // совпадал и родитель видел «учитель ещё не отметил», хотя отметка была.
    // Считаем дату по локальному календарю и берём ту же UTC-полночь.
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const todayStart = new Date(todayStr)

    const [todayAttendance, todaySchedule, lastPayment, todayDiary, todayKidNote] =
      await Promise.all([
        this.prisma.attendance.findFirst({
          where: { studentId: kidId, date: todayStart },
        }),
        this.prisma.scheduleItem.findMany({
          where: {
            groupId: kid.groupId,
            dayOfWeek: ((new Date().getDay() + 6) % 7) + 1, // Mon=1..Sun=7
          },
          orderBy: { startTime: 'asc' },
        }),
        this.prisma.payment.findFirst({
          where: { studentId: kidId },
          orderBy: { month: 'desc' },
        }),
        this.prisma.diaryEntry.findUnique({
          where: { groupId_date: { groupId: kid.groupId, date: todayStart } },
        }),
        this.prisma.kidNote.findUnique({
          where: { studentId_date: { studentId: kidId, date: todayStart } },
        }),
      ])

    return {
      kid,
      today: {
        attendance: todayAttendance,
        schedule: todaySchedule,
        diary: todayDiary,
        kidNote: todayKidNote,
      },
      lastPayment: normPayment(lastPayment),
    }
  }
}

@ApiTags('parent')
@ApiBearerAuth()
@Controller({ path: 'parent', version: '1' })
@UseGuards(RolesGuard)
@Roles('PARENT')
class ParentController {
  constructor(private readonly service: ParentService) {}

  @Get('me/kids')
  myKids(@CurrentUser() user: AuthUser) {
    return this.service.myKids(user)
  }

  @Get('kids/:id/today')
  kidToday(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.kidToday(user, id)
  }

  @Get('kids/:id/schedule')
  kidSchedule(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.kidSchedule(user, id)
  }

  @Get('kids/:id/attendance')
  kidAttendance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.kidAttendance(user, id, from, to)
  }

  @Get('kids/:id/payments')
  kidPayments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.kidPayments(user, id)
  }

  @Get('kids/:id/grades')
  kidGrades(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.kidGrades(user, id, from, to)
  }

  @Get('kids/:id/grades/stats')
  kidGradeStats(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.kidGradeStats(user, id, from, to)
  }

  @Get('kids/:id/homework')
  kidHomework(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.kidHomework(user, id)
  }
}

@Module({
  controllers: [ParentController],
  providers: [ParentService],
})
export class ParentModule {}
