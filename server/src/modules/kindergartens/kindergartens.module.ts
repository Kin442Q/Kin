import { Module } from '@nestjs/common'
import { KindergartensService } from './kindergartens.service'
import { KindergartensController } from './kindergartens.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { MailModule } from '../mail/mail.module'
import { PasswordTokensModule } from '../password-tokens/password-tokens.module'

@Module({
  imports: [PrismaModule, MailModule, PasswordTokensModule],
  controllers: [KindergartensController],
  providers: [KindergartensService],
})
export class KindergartensModule {}
