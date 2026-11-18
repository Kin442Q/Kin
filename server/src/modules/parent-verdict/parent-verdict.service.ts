import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { ClassAccessService } from '../class-access/class-access.service'
import { FeaturesService } from '../features/features.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { addDays, isMonth, monthEnd, monthStart, previousMonth, schoolToday } from './verdict-dates'
import { computeVerdictSignals, type AttendanceStatusValue } from './verdict-rules'
import { thresholdsFor, type VerdictScale } from './verdict-scale'

const dateOnly = (date: Date) => date.toISOString().slice(0, 10)
/** Даты в базе (@db.Date) — UTC-полночь календарного дня. */
const dbDate = (day: string) => new Date(`${day}T00:00:00Z`)

/**
 * Этап 1: расчёт сигналов вердикта по классу за месяц. Только чтение — ничего не пишет в базу,
 * ничего не отправляет. Доступ: классный руководитель этого класса или администратор школы.
 * Все выборки ограничены одним классом, к которому у пользователя уже проверен доступ.
 */
@Injectable()
export class ParentVerdictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassAccessService,
    private readonly features: FeaturesService,
  ) {}

  async preview(user: AuthUser, groupId: string, month: string, now: Date = new Date()) {
    if (!isMonth(month)) throw new BadRequestException('Укажите месяц в формате ГГГГ-ММ')
    const today = schoolToday(now)
    if (monthStart(month) > today) throw new BadRequestException('Этот месяц ещё не начался')
    const asOf = monthEnd(month) < today ? monthEnd(month) : today

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, kindergartenId: true, homeroomTeacherId: true },
    })
    if (!group) throw new NotFoundException('Класс не найден')
    await this.access.assertHomeroomAccess(user, group)

    const school = group.kindergartenId
      ? await this.prisma.kindergarten.findUnique({ where: { id: group.kindergartenId }, select: { gradeScale: true } })
      : null
    const scale: VerdictScale = school?.gradeScale ?? 'FIVE'
    const thresholds = thresholdsFor(scale)

    const [withAttendance, withSchedule, withHomework] = await Promise.all([
      this.features.isEnabled(group.kindergartenId, 'attendance'),
      this.features.isEnabled(group.kindergartenId, 'schedule'),
      this.features.isEnabled(group.kindergartenId, 'homework'),
    ])
    const sections = { attendance: withAttendance, schedule: withSchedule, homework: withHomework }

    const monthFrom = monthStart(month)
    const windowFrom = addDays(asOf, -(thresholds.noGradesDays - 1))
    const gradesFrom = monthStart(previousMonth(month))
    const attendanceFrom = windowFrom < monthFrom ? windowFrom : monthFrom

    const students = await this.prisma.student.findMany({
      where: { groupId: group.id, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    })
    const ids = students.map((s) => s.id)

    const [subjects, grades, attendance, schedule, terms, homework] = await Promise.all([
      this.prisma.subject.findMany({
        where: { kindergartenId: group.kindergartenId },
        select: { id: true, name: true },
      }),
      ids.length
        ? this.prisma.grade.findMany({
            where: { studentId: { in: ids }, date: { gte: dbDate(gradesFrom), lte: dbDate(asOf) } },
            select: { studentId: true, subjectId: true, value: true, date: true, createdAt: true },
          })
        : [],
      withAttendance && ids.length
        ? this.prisma.attendance.findMany({
            where: { studentId: { in: ids }, date: { gte: dbDate(attendanceFrom), lte: dbDate(asOf) } },
            select: { studentId: true, date: true, status: true },
          })
        : [],
      withSchedule
        ? this.prisma.scheduleItem.findMany({
            where: { groupId: group.id },
            select: { subjectId: true, dayOfWeek: true },
          })
        : [],
      this.prisma.term.findMany({
        where: { kindergartenId: group.kindergartenId },
        select: { startDate: true, endDate: true },
      }),
      withHomework && ids.length
        ? this.prisma.homework.findMany({
            where: { groupId: group.id, dueDate: { gte: dbDate(monthFrom), lte: dbDate(asOf) } },
            select: {
              id: true,
              subjectId: true,
              dueDate: true,
              submissions: { where: { studentId: { in: ids } }, select: { studentId: true, status: true } },
            },
          })
        : [],
    ])

    const result = computeVerdictSignals({
      month,
      asOf,
      scale,
      thresholds,
      subjects,
      students: ids.map((id) => ({ id })),
      grades: grades.map((g) => ({
        studentId: g.studentId,
        subjectId: g.subjectId,
        value: g.value,
        date: dateOnly(g.date),
        createdAt: g.createdAt.toISOString(),
      })),
      attendance: attendance.map((a) => ({
        studentId: a.studentId,
        date: dateOnly(a.date),
        status: a.status as AttendanceStatusValue,
      })),
      schedule,
      terms: terms.map((term) => ({ startDate: dateOnly(term.startDate), endDate: dateOnly(term.endDate) })),
      homework: homework.map((hw) => ({
        id: hw.id,
        subjectId: hw.subjectId,
        dueDate: dateOnly(hw.dueDate),
        submissions: hw.submissions,
      })),
      sections,
    })

    const studentById = new Map(students.map((s) => [s.id, s]))
    return {
      group: { id: group.id, name: group.name },
      month,
      asOf,
      scale,
      thresholds,
      sections,
      window: result.window,
      journalSilent: result.journalSilent,
      blockedStudents: result.blockedStudents,
      students: result.students.map(({ studentId, ...rest }) => ({ student: studentById.get(studentId)!, ...rest })),
    }
  }
}
