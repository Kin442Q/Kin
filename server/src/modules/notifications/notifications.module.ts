import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import {
  QUEUE_TELEGRAM,
  QUEUE_PAYMENT_REMINDER,
} from '../../infrastructure/bullmq/bull.module'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_TELEGRAM },
      { name: QUEUE_PAYMENT_REMINDER },
    ),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
