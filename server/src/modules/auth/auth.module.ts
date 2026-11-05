import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy'
import { NotificationsModule } from '../notifications/notifications.module'
import { FeaturesModule } from '../features/features.module'
import { MailModule } from '../mail/mail.module'
import { PasswordTokensModule } from '../password-tokens/password-tokens.module'
import { StudentLinksModule } from '../student-links/student-links.module'

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    NotificationsModule,
    FeaturesModule,
    MailModule,
    PasswordTokensModule,
    StudentLinksModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
