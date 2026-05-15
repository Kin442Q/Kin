import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TelegramService } from './telegram.service'
import { TelegramLinkService } from './telegram-link.service'
import { TelegramLinkController } from './telegram-link.controller'
import { TelegramBotService } from './telegram-bot.service'
import { TelegramProcessor } from '../../jobs/telegram.processor'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_TELEGRAM } from '../../infrastructure/bullmq/bull.module'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_TELEGRAM }),
  ],
  providers: [
    TelegramService,
    TelegramLinkService,
    TelegramBotService,
    TelegramProcessor,
  ],
  controllers: [TelegramLinkController],
  exports: [TelegramService, TelegramLinkService],
})
export class TelegramModule {}
