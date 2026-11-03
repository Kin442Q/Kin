import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'

import { QuizzesService } from './quizzes.service'
import { CreateQuizDto, SubmitAttemptDto, UpdateQuizDto } from './quizzes.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('quizzes')
@ApiBearerAuth()
@Feature('quiz')
@Controller({ path: 'quizzes', version: '1' })
@UseGuards(RolesGuard)
export class QuizzesController {
  constructor(private readonly service: QuizzesService) {}

  @Get()
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiQuery({ name: 'examTrackId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiOperation({ summary: 'Квизы школы: сотрудникам все, ученику — опубликованные с его лучшим результатом' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('examTrackId') examTrackId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.list(user, { examTrackId, subjectId })
  }

  @Post()
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Создать квиз с вопросами' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQuizDto) {
    return this.service.create(user, dto)
  }

  @Get(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Квиз целиком, с правильными ответами (для редактора)' })
  getForEdit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getForEdit(user, id)
  }

  @Patch(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Изменить квиз (автор или админ школы). questions заменяют все вопросы.' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateQuizDto) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }

  @Get(':id/results')
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Результаты учеников по квизу' })
  results(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.results(user, id)
  }

  // ─── ученик ────────────────────────────────────────────────────

  @Get(':id/play')
  @Roles('STUDENT')
  @Feature('portal', 'quiz')
  @ApiOperation({ summary: 'Квиз для прохождения (без правильных ответов)' })
  play(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.play(user, id)
  }

  @Post(':id/attempts')
  @Roles('STUDENT')
  @Feature('portal', 'quiz')
  @ApiOperation({ summary: 'Сдать квиз: { answers: [{ questionId, selected: [индексы] }], durationSec? } → оценка и разбор' })
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SubmitAttemptDto) {
    return this.service.submit(user, id, dto)
  }

  @Get(':id/my-attempts')
  @Roles('STUDENT')
  @Feature('portal', 'quiz')
  @ApiOperation({ summary: 'Мои попытки по квизу' })
  myAttempts(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.myAttempts(user, id)
  }
}
