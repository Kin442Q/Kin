import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { AccessService } from './access.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('access')
@ApiBearerAuth()
@Controller({ path: 'access', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Post('users/:id/send-link')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Отправить учителю, администратору или родителю своей школы письмо со ссылкой: приглашение (если ещё не входил) или смена пароля. Пароль никому не показывается',
  })
  sendLink(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.access.sendLink(user, id)
  }
}
