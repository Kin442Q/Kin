import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { QUEUE_ATTENDANCE_NOTICE } from '../../infrastructure/bullmq/bull.module'
import { MarkAttendanceDto } from './dto/attendance.dto'
import type { AbsenceNoticeJob } from './attendance-notice.processor'
import type { AuthUser } from '../../common/types/jwt-payload'

/** Через сколько сообщать родителям об отсутствии (секунды): время исправить случайный тап. */
const ABSENCE_NOTICE_DELAY_SECONDS = Number(
  process.env.ABSENCE_NOTICE_DELAY_SECONDS ?? 180,
)

/** Сегодняшний день школы (YYYY-MM-DD) по времени Душанбе, а не сервера. */
const schoolToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dushanbe',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUE_ATTENDANCE_NOTICE) private readonly noticeQ: Queue,
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

    await this.scheduleAbsenceNotice(dto.studentId, date, dto.status)
    return a
  }

  /**
   * Отсутствие сегодня → родителям уйдёт уведомление (push + «Оповещения») через несколько минут.
   *
   * - Не сегодняшние отметки (правка прошлых дней) родителей не беспокоят.
   * - Пока задание ждёт своей очереди, jobId один на ученика и день: повторные тапы «Нет» его не дублируют.
   * - Исправили отметку («Нет» → «Есть») до отправки — ожидающее задание снимается.
   * - Завершённое задание удаляется (removeOnComplete), поэтому уже ПОСЛЕ исправления человек может снова
   *   отметить «Нет», и родитель получит уведомление. От дубля по дню защищает процессор (смотрит в «Оповещения»).
   */
  private async scheduleAbsenceNotice(
    studentId: string,
    date: Date,
    status: string,
  ): Promise<void> {
    const day = date.toISOString().slice(0, 10)
    if (day !== schoolToday()) return
    const jobId = `absence-${studentId}-${day}`
    try {
      if (status !== 'ABSENT') {
        const pending = await this.noticeQ.getJob(jobId)
        if (pending && (await pending.isDelayed())) await pending.remove()
        return
      }
      const job: AbsenceNoticeJob = { studentId, date: day }
      await this.noticeQ.add('absence', job, {
        jobId,
        delay: ABSENCE_NOTICE_DELAY_SECONDS * 1000,
        removeOnComplete: true,
      })
    } catch (e) {
      // без Redis отметка всё равно сохраняется; родитель просто не получит уведомление
      this.logger.warn(`Не удалось обновить уведомление об отсутствии: ${(e as Error).message}`)
    }
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
