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
@Roles('SUPER_ADMIN')
export class KindergartensController {
  constructor(private readonly service: KindergartensService) {}

  @Get()
  @ApiOperation({ summary: 'Список садиков (только владелец платформы)' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user)
  }

  @Post()
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
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    dto: { name?: string; address?: string; phone?: string; isActive?: boolean },
  ) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
