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
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

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

@Injectable()
class ScheduleService {
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

  async create(user: AuthUser, dto: CreateScheduleDto) {
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
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(dto.groupId)
    ) {
      throw new ForbiddenException(
        'Можно добавлять расписание только своим классам',
      )
    }
    return this.prisma.scheduleItem.create({ data: dto })
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
