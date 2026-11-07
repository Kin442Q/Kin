import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { levelOf, STREAK_LOOKBACK_DAYS, streakDays, totalXp } from './student-progress'

/** Календарная дата «сегодня» как UTC-полночь (так хранятся @db.Date). */
function today(): Date {
  const n = new Date()
  const pad = (x: number) => String(x).padStart(2, '0')
  return new Date(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`)
}

const DAY_MS = 24 * 3600_000

/**
 * Кабинет ученика: свои домашние задания, оценки, расписание. Ученик видит
 * только себя и свой класс — id ученика берётся из токена, не из запроса.
 */
@Injectable()
export class StudentPortalService {
  constructor(private readonly prisma: PrismaService) {}

  private async me(user: AuthUser) {
    if (!user.studentId) throw new ForbiddenException('Аккаунт не привязан к ученику')
    const student = await this.prisma.student.findUnique({
      where: { id: user.studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        photoUrl: true,
        status: true,
        groupId: true,
        group: { select: { id: true, name: true, homeroomTeacher: { select: { id: true, fullName: true } } } },
      },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    if (student.status === 'ARCHIVED') throw new ForbiddenException('Аккаунт ученика отключён')
    return student
  }

  async profile(user: AuthUser) {
    const s = await this.me(user)
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      middleName: s.middleName,
      photoUrl: s.photoUrl,
      group: { id: s.group.id, name: s.group.name },
      homeroomTeacher: s.group.homeroomTeacher,
    }
  }

  /**
   * ДЗ моего класса со статусом выполнения. По умолчанию — за последние
   * 14 дней и все будущие.
   */
  async homework(user: AuthUser, params: { from?: string; to?: string }) {
    const s = await this.me(user)
    const from = params.from ? new Date(params.from) : new Date(today().getTime() - 14 * DAY_MS)
    const list = await this.prisma.homework.findMany({
      where: {
        groupId: s.groupId,
        dueDate: { gte: from, ...(params.to ? { lte: new Date(params.to) } : {}) },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        submissions: { where: { studentId: s.id }, select: { status: true, comment: true, updatedAt: true } },
      },
    })
    return list.map(({ submissions, ...hw }) => ({ ...hw, submission: submissions[0] ?? null }))
  }

  /**
   * Ученик отмечает «я сделал» (submitted = true) или снимает отметку.
   * Если учитель уже проверил (DONE / PARTIAL / NOT_DONE) — его вердикт
   * ученик не меняет.
   */
  async setSubmitted(user: AuthUser, homeworkId: string, submitted: boolean) {
    const s = await this.me(user)
    const hw = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
      select: { id: true, groupId: true },
    })
    // Чужое ДЗ для ученика «не существует».
    if (!hw || hw.groupId !== s.groupId) throw new NotFoundException('ДЗ не найдено')

    const existing = await this.prisma.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId: s.id } },
    })
    if (existing && existing.status !== 'SUBMITTED') {
      throw new ConflictException('Учитель уже проверил это задание')
    }

    if (!submitted) {
      if (existing) {
        await this.prisma.homeworkSubmission.delete({ where: { id: existing.id } })
      }
      return { status: null }
    }
    const saved = await this.prisma.homeworkSubmission.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId: s.id } },
      create: { homeworkId, studentId: s.id, status: 'SUBMITTED', markedById: user.sub },
      update: {},
    })
    return { status: saved.status }
  }

  /** Мои оценки (последние) и средний балл по предметам. */
  async grades(user: AuthUser, params: { from?: string; to?: string }) {
    const s = await this.me(user)
    const items = await this.prisma.grade.findMany({
      where: {
        studentId: s.id,
        ...(params.from || params.to
          ? {
              date: {
                ...(params.from ? { gte: new Date(params.from) } : {}),
                ...(params.to ? { lte: new Date(params.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      include: { subject: { select: { id: true, name: true, color: true } } },
    })

    const bySubject = new Map<string, { subject: { id: string; name: string; color: string }; sum: number; count: number }>()
    for (const g of items) {
      const cur = bySubject.get(g.subjectId) ?? { subject: g.subject, sum: 0, count: 0 }
      cur.sum += g.value
      cur.count++
      bySubject.set(g.subjectId, cur)
    }
    const averages = [...bySubject.values()]
      .map((x) => ({ subject: x.subject, count: x.count, average: Number((x.sum / x.count).toFixed(2)) }))
      .sort((a, b) => a.subject.name.localeCompare(b.subject.name, 'ru'))

    return { items, averages }
  }

  async schedule(user: AuthUser) {
    const s = await this.me(user)
    return this.prisma.scheduleItem.findMany({
      where: { groupId: s.groupId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: { subject: { select: { id: true, name: true, color: true } } },
    })
  }

  /**
   * Серия дней, XP и уровень. Считается из квизов, игр и отметок «сделал» (см. student-progress.ts), без отдельных
   * таблиц. Верные ответы в квизах — сумма `score` по всем попыткам.
   */
  async progress(user: AuthUser) {
    const s = await this.me(user)
    const since = new Date(Date.now() - STREAK_LOOKBACK_DAYS * DAY_MS)
    const done = { in: ['SUBMITTED', 'DONE', 'PARTIAL'] as Array<'SUBMITTED' | 'DONE' | 'PARTIAL'> }

    const [quizSum, quizRecent, homeworkCount, homeworkRecent, gameCount, gameRecent] = await Promise.all([
      this.prisma.quizAttempt.aggregate({ where: { studentId: s.id }, _sum: { score: true } }),
      this.prisma.quizAttempt.findMany({
        where: { studentId: s.id, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.homeworkSubmission.count({ where: { studentId: s.id, status: done } }),
      this.prisma.homeworkSubmission.findMany({
        where: { studentId: s.id, status: done, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.gameScore.count({ where: { studentId: s.id } }),
      this.prisma.gameScore.findMany({
        where: { studentId: s.id, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ])

    const xp = totalXp({
      correctAnswers: quizSum._sum.score ?? 0,
      homework: homeworkCount,
      games: gameCount,
    })
    const level = levelOf(xp)
    return {
      xp,
      level: level.level,
      xpIntoLevel: level.intoLevel,
      levelSize: level.levelSize,
      streakDays: streakDays([...quizRecent, ...homeworkRecent, ...gameRecent].map((r) => r.createdAt)),
    }
  }
}
