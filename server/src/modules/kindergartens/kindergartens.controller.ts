import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { KindergartensService } from './kindergartens.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('kindergartens')
@ApiBearerAuth()
@Controller({ path: 'kindergartens', version: '1' })
@UseGuards(RolesGuard)
export class KindergartensController {
  constructor(private readonly service: KindergartensService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Список садиков (только владелец платформы)' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user)
  }

  @Patch('mine')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Обновить настройки СВОЕГО учреждения (тип, гео, радиус). Доступно админу садика/школы.',
  })
  updateMine(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      name?: string
      address?: string
      phone?: string
      /** Шкала оценок школы: FIVE | TEN. Район директор не меняет — его назначает владелец платформы. */
      gradeScale?: 'FIVE' | 'TEN'
      latitude?: number | null
      longitude?: number | null
      checkInRadiusMeters?: number
    },
  ) {
    return this.service.updateMine(user, dto)
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Создать учреждение (садик/школа) + первого SUPER_ADMIN атомарно',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      name: string
      address?: string
      phone?: string
      /** id района или города из справочника GET /regions. */
      districtId: string
      gradeScale?: 'FIVE' | 'TEN'
      owner: {
        fullName: string
        /** На этот адрес уходит приглашение со ссылкой, где директор сам задаёт пароль. */
        email: string
      }
    },
  ) {
    return this.service.create(user, dto)
  }

  @Post(':id/resend-invite')
  @Roles('SUPER_ADMIN')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Отправить директору школы приглашение ещё раз (или ссылку для смены пароля, если он уже входил)',
  })
  resendInvite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resendOwnerInvite(user, id)
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string
      address?: string
      phone?: string
      /** null — снять привязку к району. */
      districtId?: string | null
      gradeScale?: 'FIVE' | 'TEN'
      isActive?: boolean
      latitude?: number | null
      longitude?: number | null
      checkInRadiusMeters?: number
    },
  ) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
