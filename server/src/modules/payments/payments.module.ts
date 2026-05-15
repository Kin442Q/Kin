import { Module } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports: [PrismaModule, TelegramModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
