import {
  Body,
  Controller,
  Get,
  Global,
  HttpException,
  HttpStatus,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'
import { PushService } from './push.service'
import { SmsService } from './sms.service'

// Сервис живёт в своём файле; остальные модули по-прежнему импортируют его отсюда.
export { PushService } from './push.service'
export type { PushPayload, PushResult, PushFailure } from './push.service'
export { SmsService } from './sms.service'

class RegisterPushTokenDto {
  @IsString() @MinLength(10) @MaxLength(200) token!: string
}

/** Не чаще раза в 20 секунд на пользователя: тест — это настоящая отправка через Expo. */
const TEST_COOLDOWN_MS = 20_000

@ApiTags('push')
@ApiBearerAuth()
@Controller({ path: 'push', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT')
class PushController {
  private readonly lastTest = new Map<string, number>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Зарегистрировать Expo push-токен текущего пользователя',
  })
  async register(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    const token = dto.token.trim()
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return { ok: false }
    }
    // Токен принадлежит телефону. Если на нём раньше сидел другой аккаунт (выход без сети,
    // общий планшет), снимаем с него — иначе чужие уведомления придут на этот телефон.
    await this.prisma.user.updateMany({
      where: { expoPushToken: token, id: { not: user.sub } },
      data: { expoPushToken: null },
    })
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { expoPushToken: token },
    })
    return { ok: true }
  }

  @Post('unregister')
  @ApiOperation({
    summary:
      'Удалить push-токен (например, при logout, чтобы не получать уведомления на другом устройстве)',
  })
  async unregister(@CurrentUser() user: AuthUser) {
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { expoPushToken: null },
    })
    return { ok: true }
  }

  @Get('status')
  @ApiOperation({ summary: 'Знает ли сервер push-токен этого пользователя' })
  async status(@CurrentUser() user: AuthUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { expoPushToken: true },
    })
    return { registered: !!u?.expoPushToken }
  }

  @Post('test')
  @ApiOperation({
    summary: 'Отправить себе тестовое push-уведомление и показать результат отправки',
  })
  async test(@CurrentUser() user: AuthUser) {
    const now = Date.now()
    const last = this.lastTest.get(user.sub) ?? 0
    if (now - last < TEST_COOLDOWN_MS) {
      throw new HttpException(
        'Подождите немного и повторите',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    this.lastTest.set(user.sub, now)

    const { registered, result } = await this.push.sendTest(user.sub)
    if (!registered || !result) return { registered: false, accepted: 0, error: null }
    const failure = result.failures[0]
    return {
      registered: true,
      accepted: result.accepted,
      error: failure ? { code: failure.error, message: failure.message } : null,
    }
  }
}

@Global()
@Module({
  controllers: [PushController],
  providers: [PushService, SmsService],
  exports: [PushService, SmsService],
})
export class PushModule {}
