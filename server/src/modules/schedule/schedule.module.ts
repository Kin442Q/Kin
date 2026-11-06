import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Query,
  Injectable,
  Delete,
  Param,
  HttpCode,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'
import { Feature } from '../../common/decorators/feature.decorator'

class CreateScheduleDto {
  @IsString() groupId!: string
  @IsInt() @Min(1) @Max(7) dayOfWeek!: number
  @IsString() startTime!: string
  @IsString() endTime!: string
  @IsString() activity!: string
  /** Только для школы */
  @IsOptional() @IsString() subjectId?: string
  @IsOptional() @IsString() teacherId?: string
  @IsOptional() @IsString() room?: string
}

class UpdateScheduleDto {
  @IsOptional() @IsInt() @Min(1) @Max(7) dayOfWeek?: number
  @IsOptional() @IsString() startTime?: string
  @IsOptional() @IsString() endTime?: string
  @IsOptional() @IsString() activity?: string
  @IsOptional() @IsString() subjectId?: string
  @IsOptional() @IsString() teacherId?: string
  @IsOptional() @IsString() room?: string
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Один урок из пакета: время, предмет (или активность), учитель, кабинет. */
class BulkLessonDto {
  @IsString() @Matches(TIME_RE, { message: 'Время начала в формате ЧЧ:ММ' }) startTime!: string
  @IsString() @Matches(TIME_RE, { message: 'Время конца в формате ЧЧ:ММ' }) endTime!: string
  @IsOptional() @IsString() @MaxLength(120) activity?: string
  @IsOptional() @IsString() subjectId?: string
  @IsOptional() @IsString() teacherId?: string
  @IsOptional() @IsString() @MaxLength(40) room?: string
}

/**
 * Сразу много уроков: одному классу, в несколько дней недели. Один список уроков
 * (звонки, предметы, учителя) применяется ко всем выбранным дням.
 */
class BulkScheduleDto {
  @IsString() groupId!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days!: number[]

  /** true — сначала убрать у класса все уроки в выбранные дни (пересобрать день заново). */
  @IsOptional() @IsBoolean() replace?: boolean

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BulkLessonDto)
  lessons!: BulkLessonDto[]
}

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /** Все классы учителя: основная группа + M:N teachingGroups. */
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

  async list(user: AuthUser, groupId?: string) {
    const where: Record<string, unknown> = {
      ...(user.kindergartenId
        ? { group: { kindergartenId: user.kindergartenId } }
        : {}),
    }

    if (user.role === 'TEACHER') {
      // Учитель видит расписание ВСЕХ своих классов (основной + назначенные),
      // а не только основной группы. Если запрошен конкретный свой класс — он.
      const allowed = await this.teacherGroupIds(user)
      if (allowed.length === 0) return []
      where.groupId =
        groupId && allowed.includes(groupId) ? groupId : { in: allowed }
    } else if (groupId) {
      where.groupId = groupId
    }

    return this.prisma.scheduleItem.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: {
        subject: { select: { id: true, name: true, color: true } },
      },
    })
  }

  /** Класс из своей школы; учитель — только свой класс. */
  private async assertGroupAccess(user: AuthUser, groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } })
    if (!group) throw new NotFoundException('Группа не найдена')
    if (user.kindergartenId && group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Группа из другого садика')
    }
    if (user.role === 'TEACHER' && !(await this.teacherGroupIds(user)).includes(groupId)) {
      throw new ForbiddenException('Можно добавлять расписание только своим классам')
    }
    return group
  }

  async create(user: AuthUser, dto: CreateScheduleDto) {
    await this.assertGroupAccess(user, dto.groupId)
    return this.prisma.scheduleItem.create({ data: dto })
  }

  /**
   * Добавить сразу много уроков: список уроков × выбранные дни недели. Всё в одной транзакции.
   * Точные повторы (тот же день, время и предмет) пропускаются, а не дублируются;
   * replace = true заранее убирает у класса все уроки в выбранные дни.
   */
  async createBulk(user: AuthUser, dto: BulkScheduleDto) {
    const group = await this.assertGroupAccess(user, dto.groupId)
    const days = Array.from(new Set(dto.days)).sort((a, b) => a - b)

    // Время: начало раньше конца, уроки одного дня не пересекаются
    const sorted = [...dto.lessons].sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (const l of sorted) {
      if (l.startTime >= l.endTime) {
        throw new BadRequestException(`Урок ${l.startTime}–${l.endTime}: конец должен быть позже начала`)
      }
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        throw new BadRequestException(
          `Уроки пересекаются по времени: ${sorted[i - 1].startTime}–${sorted[i - 1].endTime} и ${sorted[i].startTime}–${sorted[i].endTime}`,
        )
      }
    }

    // Предметы и учителя — только из этой школы
    const subjectIds = Array.from(new Set(dto.lessons.map((l) => l.subjectId).filter((x): x is string => !!x)))
    const subjects = subjectIds.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: subjectIds }, kindergartenId: group.kindergartenId },
          select: { id: true, name: true },
        })
      : []
    if (subjects.length !== subjectIds.length) throw new NotFoundException('Предмет не найден')
    const subjectName = new Map(subjects.map((x) => [x.id, x.name]))

    const teacherIds = Array.from(new Set(dto.lessons.map((l) => l.teacherId).filter((x): x is string => !!x)))
    if (teacherIds.length) {
      const found = await this.prisma.user.findMany({
        where: { id: { in: teacherIds }, kindergartenId: group.kindergartenId },
        select: { id: true },
      })
      if (found.length !== teacherIds.length) throw new NotFoundException('Учитель не найден')
    }

    const rows = dto.lessons.map((l) => {
      const activity = l.subjectId ? subjectName.get(l.subjectId)! : (l.activity ?? '').trim()
      if (!activity) throw new BadRequestException(`Урок ${l.startTime}: выберите предмет или укажите название`)
      return {
        startTime: l.startTime,
        endTime: l.endTime,
        activity,
        subjectId: l.subjectId ?? null,
        teacherId: l.teacherId ?? null,
        room: l.room?.trim() || null,
      }
    })

    const existing = await this.prisma.scheduleItem.findMany({
      where: { groupId: group.id, dayOfWeek: { in: days } },
      select: { dayOfWeek: true, startTime: true, endTime: true, subjectId: true, activity: true },
    })
    const key = (d: number, r: { startTime: string; endTime: string; subjectId: string | null; activity: string }) =>
      `${d}|${r.startTime}|${r.endTime}|${r.subjectId ?? r.activity}`
    const have = new Set(existing.map((e) => key(e.dayOfWeek, e)))

    const data: Array<{ groupId: string; dayOfWeek: number } & (typeof rows)[number]> = []
    let skipped = 0
    for (const d of days) {
      for (const r of rows) {
        if (!dto.replace && have.has(key(d, r))) {
          skipped++
          continue
        }
        data.push({ groupId: group.id, dayOfWeek: d, ...r })
      }
    }

    const ops = []
    if (dto.replace) {
      ops.push(this.prisma.scheduleItem.deleteMany({ where: { groupId: group.id, dayOfWeek: { in: days } } }))
    }
    ops.push(this.prisma.scheduleItem.createMany({ data }))
    await this.prisma.$transaction(ops)
    return { created: data.length, skipped, replaced: dto.replace ? existing.length : 0 }
  }

  async update(user: AuthUser, id: string, dto: UpdateScheduleDto) {
    const existing = await this.prisma.scheduleItem.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!existing) throw new NotFoundException('Запись не найдена')
    if (
      user.kindergartenId &&
      existing.group.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Запись из другого садика')
    }
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(existing.groupId)
    ) {
      throw new ForbiddenException('Можно менять расписание только своих классов')
    }
    return this.prisma.scheduleItem.update({ where: { id }, data: dto })
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.scheduleItem.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!existing) throw new NotFoundException('Запись не найдена')
    if (
      user.kindergartenId &&
      existing.group.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Запись из другого садика')
    }
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(existing.groupId)
    ) {
      throw new ForbiddenException(
        'Можно удалять расписание только своих классов',
      )
    }
    return this.prisma.scheduleItem.delete({ where: { id } })
  }
}

@ApiTags('schedule')
@ApiBearerAuth()
@Feature('schedule')
@Controller({ path: 'schedule', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('groupId') groupId?: string) {
    return this.service.list(user, groupId)
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.service.create(user, dto)
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  createBulk(@CurrentUser() user: AuthUser, @Body() dto: BulkScheduleDto) {
    return this.service.createBulk(user, dto)
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
