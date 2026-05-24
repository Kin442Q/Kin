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

  /** Все классы, которые ведёт учитель: основная группа + M:N teachingGroups. */
  private async teacherGroupIds(user: AuthUser): Promise<string[]> {
    const me = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { groupId: true, teachingGroups: { select: { id: true } } },
    })
    return Array.from(
      new Set(
        [me?.groupId, ...(me?.teachingGroups.map((g) => g.id) ?? [])].filter(
          (x): x is string => !!x,
        ),
      ),
    )
  }

  /**
   * Журнал посещаемости по дню/группе.
   * TEACHER ограничен своими классами (основным + назначенными). ADMIN — садиком.
   */
  async listByDay(user: AuthUser, params: { date: string; groupId?: string }) {
    const day = new Date(params.date)

    let groupWhere: Record<string, unknown> = {}
    if (user.role === 'TEACHER') {
      const allowed = await this.teacherGroupIds(user)
      if (allowed.length === 0) return []
      // если запрошен конкретный свой класс — он; иначе все его классы
      groupWhere =
        params.groupId && allowed.includes(params.groupId)
          ? { groupId: params.groupId }
          : { groupId: { in: allowed } }
    } else if (params.groupId) {
      groupWhere = { groupId: params.groupId }
    }

    return this.prisma.attendance.findMany({
      where: {
        date: day,
        ...groupWhere,
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
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(student.groupId)
    ) {
      throw new ForbiddenException('Ученик не из ваших классов')
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
