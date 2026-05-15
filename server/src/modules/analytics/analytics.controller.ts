import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('analytics')
@ApiBearerAuth()
@Controller({ path: 'analytics', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Главные KPI за месяц' })
  @ApiQuery({ name: 'month' })
  dashboard(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.service.dashboard(user, month)
  }

  @Get('profitability')
  @ApiOperation({ summary: 'Прибыльность всех групп' })
  @ApiQuery({ name: 'month' })
  profitability(
    @CurrentUser() user: AuthUser,
    @Query('month') month: string,
  ) {
    return this.service.profitability(user, month)
  }

  @Get('trend')
  @ApiOperation({ summary: 'Тренд за последние N месяцев' })
  @ApiQuery({ name: 'monthsBack', required: false })
  trend(
    @CurrentUser() user: AuthUser,
    @Query('monthsBack') monthsBack?: number,
  ) {
    return this.service.trend(user, monthsBack ? Number(monthsBack) : 12)
  }
}
