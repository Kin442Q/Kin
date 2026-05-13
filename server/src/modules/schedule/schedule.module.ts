import { Module, Controller, Get, Post, Body, UseGuards, Query, Injectable, Delete, Param, HttpCode } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsInt, IsString, Max, Min } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

/**
 * Расписание — простая модель, поэтому модуль компактный, всё в одном файле.
 * Если он разрастётся — раскладываем по dto/service/controller, как остальные.
 */

class CreateScheduleDto {
  @IsString() groupId!: string
  @IsInt() @Min(1) @Max(7) dayOfWeek!: number
  @IsString() startTime!: string
  @IsString() endTime!: string
  @IsString() activity!: string
}

@Injectable()
class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, groupId?: string) {
    const gid = user.role === 'TEACHER' ? user.groupId! : groupId
    return this.prisma.scheduleItem.findMany({
      where: gid ? { groupId: gid } : undefined,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
  }

  create(dto: CreateScheduleDto) {
    return this.prisma.scheduleItem.create({ data: dto })
  }

  remove(id: string) {
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
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() dto: CreateScheduleDto) {
    return this.service.create(dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
