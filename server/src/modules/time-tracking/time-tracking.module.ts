import { Module } from '@nestjs/common'
import { TimeTrackingController } from './time-tracking.controller'
import { TimeTrackingService } from './time-tracking.service'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService],
})
export class TimeTrackingModule {}
