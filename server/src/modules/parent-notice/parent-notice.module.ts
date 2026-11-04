import { Module } from '@nestjs/common'

import { ChatModule } from '../chat/chat.module'
import { FeaturesModule } from '../features/features.module'
import { ParentNoticeService } from './parent-notice.service'

@Module({
  imports: [ChatModule, FeaturesModule],
  providers: [ParentNoticeService],
  exports: [ParentNoticeService],
})
export class ParentNoticeModule {}
