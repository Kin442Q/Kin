import { Module } from '@nestjs/common'

import { ClassAccessModule } from '../class-access/class-access.module'
import { ParentNoticeModule } from '../parent-notice/parent-notice.module'
import { HomeworkStatusController } from './homework-status.controller'
import { HomeworkStatusService } from './homework-status.service'

@Module({
  imports: [ClassAccessModule, ParentNoticeModule],
  controllers: [HomeworkStatusController],
  providers: [HomeworkStatusService],
})
export class HomeworkStatusModule {}
