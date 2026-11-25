import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { QUEUE_ATTENDANCE_NOTICE } from '../../infrastructure/bullmq/bull.module'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PushService } from '../push/push.service'
import { SmsService } from '../push/sms.service'

export interface AbsenceNoticeJob {
  studentId: string
  /** День отметки, YYYY-MM-DD */
  date: string
}

/**
 * Сообщает родителям, что ребёнка отметили отсутствующим (push + запись в «Оповещения»).
 *
 * Задание ставится с задержкой (см. AttendanceService): учитель отмечает класс тапами, и случайное «Нет»,
 * которое он тут же исправил, не должно пугать родителя. К моменту выполнения отметка перечитывается:
 * если ученика уже отметили иначе, ничего не уходит.
 */
@Processor(QUEUE_ATTENDANCE_NOTICE)
@Injectable()
export class AttendanceNoticeProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendanceNoticeProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly sms: SmsService,
  ) {
    super()
  }

  async process(job: Job<AbsenceNoticeJob>): Promise<'sent' | 'skipped'> {
    return this.notifyAbsence(job.data.studentId, job.data.date)
  }

  async notifyAbsence(studentId: string, day: string): Promise<'sent' | 'skipped'> {
    const attendance = await this.prisma.attendance.findUnique({
      where: { studentId_date: { studentId, date: new Date(day) } },
      select: { status: true },
    })
    if (!attendance || attendance.status !== 'ABSENT') return 'skipped'

    // Один раз в день: если родителям об этом дне уже сообщали (учитель переставил «Нет» после «Есть»), не повторяем.
    const already = await this.prisma.notification.findFirst({
      where: {
        createdAt: { gte: new Date(Date.now() - 48 * 3600 * 1000) },
        AND: [
          { payload: { path: ['kind'], equals: 'absence' } },
          { payload: { path: ['studentId'], equals: studentId } },
          { payload: { path: ['date'], equals: day } },
        ],
      },
      select: { id: true },
    })
    if (already) return 'skipped'

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        firstName: true,
        lastName: true,
        status: true,
        motherPhone: true,
        fatherPhone: true,
        parents: { where: { isActive: true }, select: { phone: true } },
      },
    })
    if (!student || student.status !== 'ACTIVE') return 'skipped'

    const [y, m, d] = day.split('-')
    const name = `${student.lastName} ${student.firstName}`.trim()
    const text = `${name}: сегодня (${d}.${m}) отмечено отсутствие в школе. Если вы об этом не знали, свяжитесь с классным руководителем.`

    await this.push.sendToStudentParents(studentId, {
      title: 'Отсутствие в школе',
      body: text,
      data: { kind: 'absence', studentId, date: `${y}-${m}-${d}` },
    })

    // Место для SMS: пока провайдера нет, SmsService ничего не отправляет (см. sms.service.ts).
    const phones = [
      student.motherPhone,
      student.fatherPhone,
      ...student.parents.map((p) => p.phone),
    ].filter((p): p is string => !!p)
    await this.sms.send(phones, text).catch((e) =>
      this.logger.warn(`SMS об отсутствии не отправлено: ${(e as Error).message}`),
    )
    return 'sent'
  }
}
