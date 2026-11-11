import { Module } from '@nestjs/common'

import { MailService } from './mail.service'

/** Отправка писем (Resend). ConfigService глобальный, своих зависимостей нет. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
