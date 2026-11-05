import { Module } from '@nestjs/common'

import { PasswordTokensService } from './password-tokens.service'

/** Одноразовые ссылки «задать пароль». PrismaService и ConfigService глобальные. */
@Module({
  providers: [PasswordTokensService],
  exports: [PasswordTokensService],
})
export class PasswordTokensModule {}
