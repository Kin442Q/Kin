import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CreateTrackDto, ExamPrepService, UpdateTrackDto } from './exam-prep.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('exam-prep')
@ApiBearerAuth()
@Feature('exam_prep')
@Controller({ path: 'exam-prep/tracks', version: '1' })
@UseGuards(RolesGuard)
export class ExamPrepController {
  constructor(private readonly service: ExamPrepService) {}

  @Get()
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Направления подготовки к экзаменам; ученику — ещё и его прогресс' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user)
  }

  @Post()
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Создать направление: { name, description? } — название задаёт школа' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTrackDto) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTrackDto) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Удалить направление (квизы остаются без направления)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
