import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TelegramService } from './telegram.service'
import { TelegramController } from './telegram.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_TELEGRAM } from '../../infrastructure/bullmq/bull.module'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_TELEGRAM }),
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
