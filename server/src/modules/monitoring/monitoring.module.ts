import { Global, Module } from '@nestjs/common'

import { MailModule } from '../mail/mail.module'
import { ErrorAlertsService } from './error-alerts.service'
import { MonitoringController } from './monitoring.controller'

/** Письма владельцу об ошибках сервера (ALERT_EMAIL). Глобальный: сервис берут main.ts и фильтры ошибок. */
@Global()
@Module({
  imports: [MailModule],
  controllers: [MonitoringController],
  providers: [ErrorAlertsService],
  exports: [ErrorAlertsService],
})
export class MonitoringModule {}
