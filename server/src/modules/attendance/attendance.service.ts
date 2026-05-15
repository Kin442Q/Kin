import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { MarkAttendanceDto } from './dto/attendance.dto'
import type { AuthUser } from '../../common/types/jwt-payload'

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Журнал посещаемости по дню/группе.
   * TEACHER ограничен своей группой. ADMIN — садиком.
   */
  async listByDay(user: AuthUser, params: { date: string; groupId?: string }) {
    const groupId = user.role === 'TEACHER' ? user.groupId! : params.groupId
    if (!groupId && user.role === 'TEACHER') return []

    const day = new Date(params.date)

    return this.prisma.attendance.findMany({
      where: {
        date: day,
        ...(groupId ? { groupId } : {}),
        ...(user.kindergartenId
          ? { student: { kindergartenId: user.kindergartenId } }
          : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }],
    })
  }

  /**
   * Поставить / обновить отметку. Используем upsert по (studentId, date).
   */
  async mark(user: AuthUser, dto: MarkAttendanceDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      select: { id: true, groupId: true, kindergartenId: true },
    })
    if (!student) throw new NotFoundException('Ученик не найден')

    if (
      user.kindergartenId &&
      student.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Ученик из другого садика')
    }
    if (user.role === 'TEACHER' && student.groupId !== user.groupId) {
      throw new ForbiddenException('Ученик не из вашей группы')
    }

    const date = new Date(dto.date)
    const a = await this.prisma.attendance.upsert({
      where: { studentId_date: { studentId: dto.studentId, date } },
      create: {
        studentId: dto.studentId,
        groupId: student.groupId,
        date,
        status: dto.status,
        note: dto.note,
        markedById: user.sub,
      },
      update: {
        status: dto.status,
        note: dto.note,
        markedById: user.sub,
      },
    })

    // Инвалидируем кэш аналитики по группе (посещаемость влияет на показатели).
    await this.redis.delByPattern(`analytics:group:${student.groupId}:*`)
    return a
  }

  /**
   * Статистика по группе за период (raw SQL — быстрая агрегация одним запросом).
   */
  async groupStats(groupId: string, from: string, to: string) {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const rows = await this.prisma.$queryRaw<
      Array<{ status: string; count: bigint }>
    >`
      SELECT status, COUNT(*)::bigint AS count
      FROM "Attendance"
      WHERE "groupId" = ${groupId}
        AND "date" BETWEEN ${fromDate} AND ${toDate}
      GROUP BY status
    `
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }))
  }
}
