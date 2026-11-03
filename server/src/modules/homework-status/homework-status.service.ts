import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { ClassAccessService } from '../class-access/class-access.service'
import { ParentNoticeService } from '../parent-notice/parent-notice.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import type { NotifyParentsDto, SubmissionItemDto } from './homework-status.dto'
import { buildHomeworkNotice, templateForStatus } from './homework-notice'

/**
 * Кто как выполнил конкретное домашнее задание: отметки учителя и самоотметки
 * учеников, плюс сообщение родителям. Видят и меняют сотрудники этого класса.
 */
@Injectable()
export class HomeworkStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassAccessService,
    private readonly notice: ParentNoticeService,
  ) {}

  private async loadHomework(user: AuthUser, id: string) {
    const hw = await this.prisma.homework.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        group: { select: { id: true, name: true, kindergartenId: true } },
      },
    })
    if (!hw) throw new NotFoundException('ДЗ не найдено')
    await this.access.assertStaffAccess(user, hw.group)
    return hw
  }

  /** Ученики класса со статусом по этому ДЗ. */
  async roster(user: AuthUser, homeworkId: string) {
    const hw = await this.loadHomework(user, homeworkId)

    const students = await this.prisma.student.findMany({
      where: { groupId: hw.groupId, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, photoUrl: true, gender: true },
    })
    const [submissions, parents] = await Promise.all([
      this.prisma.homeworkSubmission.findMany({ where: { homeworkId } }),
      this.notice.parentIdsByStudent(students.map((s) => s.id)),
    ])
    const byStudent = new Map(submissions.map((s) => [s.studentId, s]))

    const rows = students.map((s) => {
      const sub = byStudent.get(s.id)
      return {
        student: s,
        status: sub?.status ?? null,
        comment: sub?.comment ?? null,
        markedAt: sub?.updatedAt ?? null,
        parentsCount: parents.get(s.id)?.length ?? 0,
      }
    })

    const count = (st: string | null) => rows.filter((r) => r.status === st).length
    return {
      homework: {
        id: hw.id,
        title: hw.title,
        description: hw.description,
        dueDate: hw.dueDate,
        subject: hw.subject,
        group: { id: hw.group.id, name: hw.group.name },
      },
      students: rows,
      summary: {
        total: rows.length,
        done: count('DONE'),
        partial: count('PARTIAL'),
        notDone: count('NOT_DONE'),
        submitted: count('SUBMITTED'),
        unmarked: count(null),
      },
    }
  }

  /** Выставить (или снять, status = null) статусы нескольким ученикам разом. */
  async setStatuses(user: AuthUser, homeworkId: string, items: SubmissionItemDto[]) {
    const hw = await this.loadHomework(user, homeworkId)

    // Один ученик — одна запись; при повторах побеждает последняя.
    const latest = new Map(items.map((i) => [i.studentId, i]))
    const ids = [...latest.keys()]
    const inClass = await this.prisma.student.count({
      where: { id: { in: ids }, groupId: hw.groupId },
    })
    if (inClass !== ids.length) {
      throw new BadRequestException('Среди учеников есть не из этого класса')
    }

    await this.prisma.$transaction(
      [...latest.values()].map((i) =>
        i.status === null
          ? this.prisma.homeworkSubmission.deleteMany({
              where: { homeworkId, studentId: i.studentId },
            })
          : this.prisma.homeworkSubmission.upsert({
              where: { homeworkId_studentId: { homeworkId, studentId: i.studentId } },
              create: {
                homeworkId,
                studentId: i.studentId,
                status: i.status,
                comment: i.comment ?? null,
                markedById: user.sub,
              },
              // comment не передан → не трогаем (массовая отметка не стирает заметки)
              update: { status: i.status, comment: i.comment, markedById: user.sub },
            }),
      ),
    )

    return this.roster(user, homeworkId)
  }

  /** Сообщение родителям выбранных учеников по шаблону (или по статусу ученика). */
  async notifyParents(user: AuthUser, homeworkId: string, dto: NotifyParentsDto) {
    const hw = await this.loadHomework(user, homeworkId)

    const ids = [...new Set(dto.studentIds)]
    const students = await this.prisma.student.findMany({
      where: { id: { in: ids }, groupId: hw.groupId },
      select: { id: true, firstName: true, gender: true },
    })
    if (students.length !== ids.length) {
      throw new BadRequestException('Среди учеников есть не из этого класса')
    }
    const subs = await this.prisma.homeworkSubmission.findMany({
      where: { homeworkId, studentId: { in: ids } },
      select: { studentId: true, status: true },
    })
    const statusOf = new Map(subs.map((s) => [s.studentId, s.status]))

    let sent = 0
    let notified = 0
    const skipped: Array<{ studentId: string; reason: 'NO_PARENTS' }> = []

    for (const s of students) {
      const text = buildHomeworkNotice({
        template: dto.template ?? templateForStatus(statusOf.get(s.id)),
        studentName: s.firstName,
        gender: s.gender,
        subject: hw.subject.name,
        title: hw.title,
        dueDate: hw.dueDate,
        note: dto.note,
      })
      const r = await this.notice.notify(user, s.id, text)
      if (r.sent > 0) {
        notified++
        sent += r.sent
      } else {
        skipped.push({ studentId: s.id, reason: 'NO_PARENTS' })
      }
    }
    return { notified, sent, skipped }
  }
}
