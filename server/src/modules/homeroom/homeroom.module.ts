import { Module } from '@nestjs/common'

import { ClassAccessModule } from '../class-access/class-access.module'
import { FeaturesModule } from '../features/features.module'
import { ParentNoticeModule } from '../parent-notice/parent-notice.module'
import { HomeroomController } from './homeroom.controller'
import { HomeroomService } from './homeroom.service'

@Module({
  imports: [ClassAccessModule, ParentNoticeModule, FeaturesModule],
  controllers: [HomeroomController],
  providers: [HomeroomService],
})
export class HomeroomModule {}
