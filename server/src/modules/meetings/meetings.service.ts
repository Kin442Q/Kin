import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { TelegramLinkService } from '../telegram/telegram-link.service'
import type { AuthUser } from '../../common/types/jwt-payload'

interface CreateMeetingDto {
  groupId: string
  title: string
  scheduledAt: string // ISO
  location?: string
  description?: string
}

interface UpdateMeetingDto {
  title?: string
  scheduledAt?: string
  location?: string
  description?: string
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramLinkService,
  ) {}

  /**
   * Список собраний. TEACHER видит только свою группу.
   */
  async list(user: AuthUser, params: { groupId?: string }) {
    const where: Prisma.MeetingWhereInput = {}

    if (user.role === 'TEACHER') {
      if (!user.groupId) return []
      where.groupId = user.groupId
    } else if (params.groupId) {
      where.groupId = params.groupId
    }

    if (user.kindergartenId) {
      where.group = { kindergartenId: user.kindergartenId }
    }

    return this.prisma.meeting.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, color: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    })
  }

  /**
   * Создать собрание + сразу разослать Telegram-уведомления родителям группы.
   */
  async create(user: AuthUser, dto: CreateMeetingDto) {
    if (!dto.groupId) throw new BadRequestException('groupId обязателен')
    if (!dto.title?.trim()) throw new BadRequestException('title обязателен')
    if (!dto.scheduledAt) throw new BadRequestException('scheduledAt обязателен')

    const scheduledAt = new Date(dto.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt должен быть валидной датой')
    }

    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
    })
    if (!group) throw new NotFoundException('Группа не найдена')

    if (
      user.kindergartenId &&
      group.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Группа из другого садика')
    }

    if (user.role === 'TEACHER' && group.id !== user.groupId) {
      throw new ForbiddenException('Можно создавать только в своей группе')
    }

    const meeting = await this.prisma.meeting.create({
      data: {
        groupId: dto.groupId,
        title: dto.title.trim(),
        scheduledAt,
        location: dto.location?.trim() || null,
        description: dto.description?.trim() || null,
        createdById: user.sub,
      },
      include: {
        group: { select: { id: true, name: true, color: true } },
      },
    })

    // Уведомление в Telegram (асинхронно — ошибки не блокируют создание)
    this.notifyParents(meeting).catch((e) => {
      this.logger.error(
        `[meetings] notifyParents failed: ${e?.message || e}`,
      )
    })

    return meeting
  }

  async update(user: AuthUser, id: string, dto: UpdateMeetingDto) {
    const existing = await this.prisma.meeting.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!existing) throw new NotFoundException('Собрание не найдено')

    if (
      user.kindergartenId &&
      existing.group.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Собрание из другого садика')
    }
    if (user.role === 'TEACHER' && existing.groupId !== user.groupId) {
      throw new ForbiddenException('Можно изменять только собрания своей группы')
    }

    const data: Prisma.MeetingUpdateInput = {}
    if (dto.title !== undefined) data.title = dto.title.trim()
    if (dto.location !== undefined) data.location = dto.location?.trim() || null
    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null
    if (dto.scheduledAt !== undefined) {
      const d = new Date(dto.scheduledAt)
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('scheduledAt должен быть валидной датой')
      }
      data.scheduledAt = d
    }

    return this.prisma.meeting.update({
      where: { id },
      data,
      include: {
        group: { select: { id: true, name: true, color: true } },
      },
    })
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.meeting.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!existing) throw new NotFoundException('Собрание не найдено')

    if (
      user.kindergartenId &&
      existing.group.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Собрание из другого садика')
    }
    if (user.role === 'TEACHER' && existing.groupId !== user.groupId) {
      throw new ForbiddenException('Можно удалять только собрания своей группы')
    }

    await this.prisma.meeting.delete({ where: { id } })
    return { success: true }
  }

  // --------------------------------------------------------------
  // Notification
  // --------------------------------------------------------------

  private async notifyParents(meeting: {
    id: string
    groupId: string
    title: string
    scheduledAt: Date
    location: string | null
    description: string | null
    group: { name: string }
  }) {
    const students = await this.prisma.student.findMany({
      where: { groupId: meeting.groupId, status: 'ACTIVE' },
      select: { motherPhone: true, fatherPhone: true },
    })

    const phones = students
      .flatMap((s) => [s.motherPhone, s.fatherPhone])
      .filter((p): p is string => !!p)

    if (phones.length === 0) {
      this.logger.log(
        `[meetings] notifyParents: в группе ${meeting.groupId} нет телефонов родителей`,
      )
      return
    }

    await this.telegram.sendMeetingNotification({
      phones,
      groupName: meeting.group.name,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      location: meeting.location,
      description: meeting.description,
    })
  }
}
