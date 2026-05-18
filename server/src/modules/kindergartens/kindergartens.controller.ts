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
      type?: 'KINDERGARTEN' | 'SCHOOL'
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
    summary: 'Создать садик + первого SUPER_ADMIN атомарно',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      name: string
      address?: string
      phone?: string
      owner: {
        fullName: string
        email: string
        password: string
      }
    },
  ) {
    return this.service.create(user, dto)
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
      isActive?: boolean
      type?: 'KINDERGARTEN' | 'SCHOOL'
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
