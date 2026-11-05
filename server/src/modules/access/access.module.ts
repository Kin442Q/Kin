import { Module } from '@nestjs/common'

import { AccessController } from './access.controller'
import { AccessService } from './access.service'
import { MailModule } from '../mail/mail.module'
import { PasswordTokensModule } from '../password-tokens/password-tokens.module'

/** Выдача доступа без паролей от админа: человеку уходит письмо со ссылкой, пароль он задаёт сам. PrismaService глобальный. */
@Module({
  imports: [MailModule, PasswordTokensModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
