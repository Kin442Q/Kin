import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { StudentStatus } from '@prisma/client'

import { StudentsService } from './students.service'
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('students')
@ApiBearerAuth()
@Controller({ path: 'students', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'Список учеников (TEACHER видит только свою группу)' })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: StudentStatus })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
    @Query('status') status?: StudentStatus,
  ) {
    return this.service.findAll(user, { groupId, status })
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user)
  }

  @Post()
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user)
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Массовое создание учеников (импорт из Excel/фото). Ошибочные строки в errors[].',
  })
  bulkCreate(
    @Body() dto: { items: Array<Partial<CreateStudentDto> & { groupName?: string }> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.bulkCreate(user, dto?.items ?? [])
  }

  @Post('scan')
  @ApiOperation({
    summary: 'Распознать учеников с фото списка (AI Vision). Возвращает черновики, без записи в БД.',
  })
  scan(@Body() dto: { image: string }, @CurrentUser() user: AuthUser) {
    return this.service.scanFromImage(user, dto?.image ?? '')
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user)
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Архивировать (soft-delete)' })
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.archive(id, user)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user)
  }

  // ─── Управление родительскими аккаунтами ученика ─────────────────

  @Get(':id/parents')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Список родителей ученика' })
  listParents(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listParents(id, user)
  }

  @Post(':id/parents')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({
    summary:
      'Создать аккаунт родителя и привязать к ученику (или привязать существующий по email)',
  })
  addParent(
    @Param('id') id: string,
    @Body()
    dto: {
      fullName?: string
      email?: string
      phone?: string
      password?: string
      /** Если задан — привязать существующего пользователя-родителя */
      existingUserId?: string
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addParent(id, dto, user)
  }

  @Delete(':id/parents/:parentId')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Отвязать родителя от ученика (аккаунт не удаляется)' })
  removeParent(
    @Param('id') id: string,
    @Param('parentId') parentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeParent(id, parentId, user)
  }
}
