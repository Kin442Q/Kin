import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { FinanceService } from './finance.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

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
  global(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.service.globalSummary(user, month)
  }

  @Get('group')
  @ApiOperation({ summary: 'Итоги по группе за месяц' })
  @ApiQuery({ name: 'groupId' })
  @ApiQuery({ name: 'month', description: 'YYYY-MM' })
  group(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId: string,
    @Query('month') month: string,
  ) {
    return this.service.groupSummary(user, groupId, month)
  }
}
