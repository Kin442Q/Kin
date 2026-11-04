import { Body, Controller, ForbiddenException, Get, Param, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { FeaturesService } from './features.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

/**
 * Управление разделами учреждения. Только владелец платформы
 * (SUPER_ADMIN без учреждения): директор школы свои разделы не меняет.
 */
@ApiTags('features')
@ApiBearerAuth()
@Controller({ path: 'kindergartens/:id/features', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class FeaturesController {
  constructor(private readonly service: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Разделы учреждения и их состояние (только владелец платформы)' })
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.assertOwner(user)
    return this.service.listForSchool(id)
  }

  @Put()
  @ApiOperation({
    summary:
      'Включить/выключить разделы: { features: { grades: true, payments: false, chat: null } }. null — вернуть значение по умолчанию.',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { features: Record<string, boolean | null> },
  ) {
    this.assertOwner(user)
    return this.service.setOverrides(id, body?.features ?? {})
  }

  private assertOwner(user: AuthUser) {
    if (user.kindergartenId) {
      throw new ForbiddenException('Разделами управляет только владелец платформы')
    }
  }
}
