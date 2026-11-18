import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsString, Matches, MinLength } from 'class-validator'

import { ParentVerdictService } from './parent-verdict.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

export class PreviewVerdictQuery {
  @IsString()
  @MinLength(1)
  groupId!: string

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Укажите месяц в формате ГГГГ-ММ' })
  month!: string
}

@ApiTags('parent-verdict')
@ApiBearerAuth()
@Feature('parent_verdict', 'grades')
@Controller({ path: 'parent-verdict', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class ParentVerdictController {
  constructor(private readonly service: ParentVerdictService) {}

  @Get('preview')
  @ApiOperation({
    summary: 'Сигналы вердикта по классу за месяц (только чтение, родителям ничего не уходит)',
  })
  preview(@CurrentUser() user: AuthUser, @Query() q: PreviewVerdictQuery) {
    return this.service.preview(user, q.groupId, q.month)
  }
}
