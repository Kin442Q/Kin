import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { FinanceService } from './finance.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'

@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Глобальные итоги за месяц' })
  @ApiQuery({ name: 'month', description: 'YYYY-MM' })
  global(@Query('month') month: string) {
    return this.service.globalSummary(month)
  }

  @Get('group')
  @ApiOperation({ summary: 'Итоги по группе за месяц' })
  @ApiQuery({ name: 'groupId' })
  @ApiQuery({ name: 'month', description: 'YYYY-MM' })
  group(@Query('groupId') groupId: string, @Query('month') month: string) {
    return this.service.groupSummary(groupId, month)
  }
}
