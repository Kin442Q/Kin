import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

import { StudentPortalService } from './student-portal.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class SetSubmittedDto {
  @IsBoolean()
  submitted!: boolean
}

/**
 * Кабинет ученика. Роль STUDENT; раздел «Кабинет ученика» должен быть
 * включён, а у ручек с данными — ещё и соответствующий раздел.
 */
@ApiTags('student')
@ApiBearerAuth()
@Feature('portal')
@Controller({ path: 'student', version: '1' })
@UseGuards(RolesGuard)
@Roles('STUDENT')
export class StudentPortalController {
  constructor(private readonly service: StudentPortalService) {}

  @Get('me')
  @ApiOperation({ summary: 'Профиль ученика: класс, классный руководитель' })
  profile(@CurrentUser() user: AuthUser) {
    return this.service.profile(user)
  }

  @Get('homework')
  @Feature('portal', 'homework')
  @ApiOperation({ summary: 'Домашние задания моего класса со статусом' })
  homework(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.homework(user, { from, to })
  }

  @Put('homework/:id/submitted')
  @Feature('portal', 'homework')
  @ApiOperation({ summary: 'Отметить «я сделал» / снять отметку: { submitted: boolean }' })
  setSubmitted(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetSubmittedDto,
  ) {
    return this.service.setSubmitted(user, id, dto.submitted)
  }

  @Get('grades')
  @Feature('portal', 'grades')
  @ApiOperation({ summary: 'Мои оценки и средний балл по предметам' })
  grades(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.grades(user, { from, to })
  }

  @Get('progress')
  @ApiOperation({ summary: 'Серия дней, XP и уровень (из квизов, игр и отметок «сделал»)' })
  progress(@CurrentUser() user: AuthUser) {
    return this.service.progress(user)
  }

  @Get('schedule')
  @Feature('portal', 'schedule')
  @ApiOperation({ summary: 'Расписание моего класса' })
  schedule(@CurrentUser() user: AuthUser) {
    return this.service.schedule(user)
  }
}
