import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { PaymentMethod } from '@prisma/client'

import { PaymentsService } from './payments.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('payments')
@ApiBearerAuth()
@Controller({ path: 'payments', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Список платежей за месяц' })
  @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM' })
  @ApiQuery({ name: 'groupId', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.service.findAll(user, { month, groupId })
  }

  @Post('upsert')
  @ApiOperation({
    summary:
      'Создать/обновить платёж по [studentId+month]. При paid:true шлёт Telegram.',
  })
  upsert(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      studentId: string
      month: string
      amount: number
      paid: boolean
      method?: PaymentMethod
      comment?: string
    },
  ) {
    return this.service.upsert(user, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
