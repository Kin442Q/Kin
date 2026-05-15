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
import { ExpenseCategory } from '@prisma/client'

import { ExpensesService } from './expenses.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('expenses')
@ApiBearerAuth()
@Controller({ path: 'expenses', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'category', required: false, enum: ExpenseCategory })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
    @Query('groupId') groupId?: string,
    @Query('category') category?: ExpenseCategory,
  ) {
    return this.service.findAll(user, { month, groupId, category })
  }

  @Post()
  @ApiOperation({ summary: 'Создать расход' })
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      category: ExpenseCategory
      description: string
      amount: number
      month: string
      groupId?: string | null
    },
  ) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    dto: {
      category?: ExpenseCategory
      description?: string
      amount?: number
      month?: string
      groupId?: string | null
    },
  ) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
