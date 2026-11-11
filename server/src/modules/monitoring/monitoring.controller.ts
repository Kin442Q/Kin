import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { ErrorAlertsService } from './error-alerts.service'

@ApiTags('monitoring')
@ApiBearerAuth()
@Controller({ path: 'monitoring', version: '1' })
@UseGuards(RolesGuard)
export class MonitoringController {
  constructor(private readonly alerts: ErrorAlertsService) {}

  @Post('test-alert')
  @HttpCode(200)
  @Roles('SUPER_ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Отправить проверочное письмо на ALERT_EMAIL (только владелец платформы)' })
  testAlert() {
    return this.alerts.sendTest()
  }
}
