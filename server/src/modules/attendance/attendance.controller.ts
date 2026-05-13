import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'

import { AttendanceService } from './attendance.service'
import { MarkAttendanceDto } from './dto/attendance.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('attendance')
@ApiBearerAuth()
@Controller({ path: 'attendance', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'Журнал на день' })
  @ApiQuery({ name: 'date', description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'groupId', required: false })
  listByDay(
    @CurrentUser() user: AuthUser,
    @Query('date') date: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.service.listByDay(user, { date, groupId })
  }

  @Post('mark')
  @ApiOperation({ summary: 'Отметить присутствие/отсутствие' })
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkAttendanceDto) {
    return this.service.mark(user, dto)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Статистика по группе за период' })
  @Roles('SUPER_ADMIN', 'ADMIN')
  stats(
    @Query('groupId') groupId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.groupStats(groupId, from, to)
  }
}
