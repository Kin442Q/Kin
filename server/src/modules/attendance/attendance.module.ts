import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { AttendanceNoticeProcessor } from './attendance-notice.processor'
import { QUEUE_ATTENDANCE_NOTICE } from '../../infrastructure/bullmq/bull.module'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_ATTENDANCE_NOTICE })],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceNoticeProcessor],
  exports: [AttendanceService],
})
export class AttendanceModule {}
