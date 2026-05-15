import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { StaffPosition } from '@prisma/client'

import { StaffService } from './staff.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('staff')
@ApiBearerAuth()
@Controller({ path: 'staff', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @ApiQuery({ name: 'position', required: false, enum: StaffPosition })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('position') position?: StaffPosition,
  ) {
    return this.service.findAll(user, { position })
  }

  @Post()
  @ApiOperation({ summary: 'Создать сотрудника' })
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      firstName: string
      lastName: string
      middleName?: string
      position: StaffPosition
      phone: string
      email?: string
      groupId?: string | null
      salary: number
      hireDate: string
    },
  ) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.service.update(user, id, dto as any)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
