import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { ClassAccessService } from '../class-access/class-access.service'
import { ParentNoticeService } from '../parent-notice/parent-notice.service'
import { FeaturesService } from '../features/features.service'
import type { AuthUser } from '../../common/types/jwt-payload'

/** Календарная дата «сегодня» как UTC-полночь (так хранятся @db.Date). */
function today(): Date {
  const n = new Date()
  const pad = (x: number) => String(x).padStart(2, '0')
  return new Date(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`)
}

const DAY_MS = 24 * 3600_000

/**
 * Классный руководитель: сводка по своему классу и связь с родителями.
 * Учитель получает эти права только на класс, где он руководитель; админ
 * школы — на любой класс своей школы.
 */
@Injectable()
export class HomeroomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassAccessService,
    private readonly notice: ParentNoticeService,
    private readonly features: FeaturesService,
  ) {}

  private async loadGroup(user: AuthUser, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, kindergartenId: true, homeroomTeacherId: true },
    })
    if (!group) throw new NotFoundException('Класс не найден')
    await this.access.assertHomeroomAccess(user, group)
    return group
  }

  /** Классы, где я классный руководитель (админу — все классы школы). */
  async mine(user: AuthUser) {
    const where = this.access.isAdmin(user)
      ? user.kindergartenId
        ? { kindergartenId: user.kindergartenId }
        : {}
      : { homeroomTeacherId: user.sub }
    const groups = await this.prisma.group.findMany({
      where: { ...where, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        homeroomTeacher: { select: { id: true, fullName: true } },
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
    })
    return groups.map(({ _count, ...g }) => ({ ...g, studentsCount: _count.students }))
  }

  /**
   * Сводка по ученикам класса за последние `days` дней: домашние задания,
   * посещаемость, оценки. Данные выключенных разделов не отдаём.
   */
  async overview(user: AuthUser, groupId: string, days: number) {
    const group = await this.loadGroup(user, groupId)
    const span = Math.min(Math.max(Math.trunc(days) || 14, 1), 90)
    const to = today()
    const from = new Date(to.getTime() - span * DAY_MS)

    const [withHomework, withAttendance, withGrades] = await Promise.all([
      this.features.isEnabled(user.kindergartenId, 'homework'),
      this.features.isEnabled(user.kindergartenId, 'attendance'),
      this.features.isEnabled(user.kindergartenId, 'grades'),
    ])

    const students = await this.prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, photoUrl: true },
    })
    const ids = students.map((s) => s.id)
    const range = { gte: from, lte: to }

    // ДЗ: сколько задано за период и как выполнено каждым учеником.
    const homeworkTotals = new Map<string, Record<string, number>>()
    let homeworkCount = 0
    if (withHomework && ids.length) {
      const hw = await this.prisma.homework.findMany({
        where: { groupId, dueDate: range },
        select: { id: true },
      })
      homeworkCount = hw.length
      if (hw.length) {
        const subs = await this.prisma.homeworkSubmission.findMany({
          where: { homeworkId: { in: hw.map((h) => h.id) }, studentId: { in: ids } },
          select: { studentId: true, status: true },
        })
        for (const s of subs) {
          const cur = homeworkTotals.get(s.studentId) ?? {}
          cur[s.status] = (cur[s.status] ?? 0) + 1
          homeworkTotals.set(s.studentId, cur)
        }
      }
    }

    const attendanceTotals = new Map<string, Record<string, number>>()
    if (withAttendance && ids.length) {
      const att = await this.prisma.attendance.findMany({
        where: { studentId: { in: ids }, date: range },
        select: { studentId: true, status: true },
      })
      for (const a of att) {
        const cur = attendanceTotals.get(a.studentId) ?? {}
        cur[a.status] = (cur[a.status] ?? 0) + 1
        attendanceTotals.set(a.studentId, cur)
      }
    }

    const gradeTotals = new Map<string, { sum: number; count: number }>()
    if (withGrades && ids.length) {
      const grades = await this.prisma.grade.findMany({
        where: { studentId: { in: ids }, date: range },
        select: { studentId: true, value: true },
      })
      for (const g of grades) {
        const cur = gradeTotals.get(g.studentId) ?? { sum: 0, count: 0 }
        cur.sum += g.value
        cur.count++
        gradeTotals.set(g.studentId, cur)
      }
    }

    const parents = await this.notice.parentIdsByStudent(ids)

    return {
      group: { id: group.id, name: group.name },
      days: span,
      from,
      to,
      sections: { homework: withHomework, attendance: withAttendance, grades: withGrades },
      homeworkCount,
      students: students.map((s) => {
        const hw = homeworkTotals.get(s.id) ?? {}
        const marked = Object.values(hw).reduce((a, b) => a + b, 0)
        const att = attendanceTotals.get(s.id) ?? {}
        const gr = gradeTotals.get(s.id)
        return {
          student: s,
          homework: withHomework
            ? {
                total: homeworkCount,
                done: hw.DONE ?? 0,
                partial: hw.PARTIAL ?? 0,
                notDone: hw.NOT_DONE ?? 0,
                submitted: hw.SUBMITTED ?? 0,
                unmarked: Math.max(homeworkCount - marked, 0),
              }
            : null,
          attendance: withAttendance
            ? {
                present: att.PRESENT ?? 0,
                absent: att.ABSENT ?? 0,
                sick: att.SICK ?? 0,
                vacation: att.VACATION ?? 0,
              }
            : null,
          grades: withGrades
            ? { count: gr?.count ?? 0, average: gr ? Number((gr.sum / gr.count).toFixed(2)) : null }
            : null,
          parentsCount: parents.get(s.id)?.length ?? 0,
        }
      }),
    }
  }

  /** Своё сообщение родителям выбранных учеников класса. */
  async notify(user: AuthUser, groupId: string, studentIds: string[], text: string) {
    await this.loadGroup(user, groupId)
    const t = text.trim()
    if (!t) throw new BadRequestException('Пустое сообщение')

    const ids = [...new Set(studentIds)]
    const inClass = await this.prisma.student.count({ where: { id: { in: ids }, groupId } })
    if (inClass !== ids.length) {
      throw new BadRequestException('Среди учеников есть не из этого класса')
    }

    let sent = 0
    let notified = 0
    const skipped: Array<{ studentId: string; reason: 'NO_PARENTS' }> = []
    for (const id of ids) {
      const r = await this.notice.notify(user, id, t)
      if (r.sent > 0) {
        notified++
        sent += r.sent
      } else {
        skipped.push({ studentId: id, reason: 'NO_PARENTS' })
      }
    }
    return { notified, sent, skipped }
  }
}
