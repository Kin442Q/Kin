import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { AllowViewer } from '../../common/decorators/allow-viewer.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import type { AuthUser } from '../../common/types/jwt-payload'
import { MinistryService, type MinistryQuery } from './ministry.service'
import { ViewersService, type CreateViewerDto, type UpdateViewerDto } from './viewers.service'

/**
 * Кабинет министерства и районных отделов образования: сводная статистика по школам охвата.
 * Только чтение и только суммы: имён учеников, оценок и посещаемости отдельных детей здесь нет.
 */
@ApiTags('ministry')
@ApiBearerAuth()
@Controller({ path: 'ministry', version: '1' })
@UseGuards(RolesGuard)
@Roles('VIEWER', 'SUPER_ADMIN')
@AllowViewer()
export class MinistryController {
  constructor(private readonly service: MinistryService) {}

  @Get('filters')
  @ApiOperation({ summary: 'Организация наблюдателя и области/районы его охвата для фильтров' })
  filters(@CurrentUser() user: AuthUser) {
    return this.service.filters(user)
  }

  @Get('overview')
  @ApiOperation({ summary: 'Итоги по школам охвата, срез по областям, школы, которым нужно внимание' })
  overview(@CurrentUser() user: AuthUser, @Query() query: MinistryQuery) {
    return this.service.overview(user, query)
  }

  @Get('schools')
  @ApiOperation({ summary: 'Школы охвата: рейтинг, нагрузка на учителя, посещаемость, координаты' })
  schools(@CurrentUser() user: AuthUser, @Query() query: MinistryQuery) {
    return this.service.schools(user, query)
  }

  @Get('districts')
  @ApiOperation({ summary: 'Сравнение районов и городов по успеваемости, посещаемости и нагрузке' })
  districts(@CurrentUser() user: AuthUser, @Query() query: MinistryQuery) {
    return this.service.districts(user, query)
  }
}

/** Учётные записи наблюдателей — только владелец платформы. Наблюдателю эти ручки закрыты. */
@ApiTags('ministry')
@ApiBearerAuth()
@Controller({ path: 'ministry/viewers', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class ViewersController {
  constructor(private readonly service: ViewersService) {}

  @Get()
  @ApiOperation({ summary: 'Наблюдатели: министерство и районные отделы' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user)
  }

  @Post()
  @ApiOperation({ summary: 'Завести наблюдателя: аккаунт, охват и письмо со ссылкой для пароля' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateViewerDto) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Изменить охват, название организации или отключить доступ' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateViewerDto) {
    return this.service.update(user, id, dto)
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Отправить письмо со ссылкой ещё раз' })
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resendInvite(user, id)
  }
}
