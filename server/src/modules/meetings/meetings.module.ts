import { Module } from '@nestjs/common'
import { MeetingsController } from './meetings.controller'
import { MeetingsService } from './meetings.service'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
})
export class MeetingsModule {}
