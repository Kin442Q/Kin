import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'

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
  dashboard(@Query('month') month: string) {
    return this.service.dashboard(month)
  }

  @Get('profitability')
  @ApiOperation({ summary: 'Прибыльность всех групп' })
  @ApiQuery({ name: 'month' })
  profitability(@Query('month') month: string) {
    return this.service.profitability(month)
  }

  @Get('trend')
  @ApiOperation({ summary: 'Тренд за последние N месяцев' })
  @ApiQuery({ name: 'monthsBack', required: false })
  trend(@Query('monthsBack') monthsBack?: number) {
    return this.service.trend(monthsBack ? Number(monthsBack) : 12)
  }
}
