import { Module } from '@nestjs/common'
import { KindergartensService } from './kindergartens.service'
import { KindergartensController } from './kindergartens.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { FilesModule } from '../files/files.module'
import { MailModule } from '../mail/mail.module'
import { PasswordTokensModule } from '../password-tokens/password-tokens.module'

@Module({
  imports: [PrismaModule, FilesModule, MailModule, PasswordTokensModule],
  controllers: [KindergartensController],
  providers: [KindergartensService],
})
export class KindergartensModule {}
