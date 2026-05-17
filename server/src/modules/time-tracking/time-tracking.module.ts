import { Module } from '@nestjs/common'
import { TimeTrackingController } from './time-tracking.controller'
import { TimeTrackingService } from './time-tracking.service'
import {
  TerminalWebhookController,
  TerminalSettingsController,
} from './terminal-webhook.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [
    TimeTrackingController,
    TerminalWebhookController,
    TerminalSettingsController,
  ],
  providers: [TimeTrackingService],
})
export class TimeTrackingModule {}
