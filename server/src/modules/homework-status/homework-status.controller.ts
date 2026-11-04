import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { HomeworkStatusService } from './homework-status.service'
import { NotifyParentsDto, SetSubmissionsDto } from './homework-status.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('homework')
@ApiBearerAuth()
@Feature('homework')
@Controller({ path: 'homework', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class HomeworkStatusController {
  constructor(private readonly service: HomeworkStatusService) {}

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Ученики класса со статусом выполнения этого ДЗ' })
  roster(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.roster(user, id)
  }

  @Put(':id/submissions')
  @ApiOperation({
    summary:
      'Выставить статусы: { items: [{ studentId, status: DONE|PARTIAL|NOT_DONE|null, comment? }] }. null — снять отметку.',
  })
  setStatuses(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetSubmissionsDto,
  ) {
    return this.service.setStatuses(user, id, dto.items)
  }

  @Post(':id/notify-parents')
  @ApiOperation({
    summary:
      'Сообщить родителям выбранных учеников о ДЗ (шаблон по статусу или явный NOT_DONE/PARTIAL/REMINDER)',
  })
  notifyParents(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NotifyParentsDto,
  ) {
    return this.service.notifyParents(user, id, dto)
  }
}
