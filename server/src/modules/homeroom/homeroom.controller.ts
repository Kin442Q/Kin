import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

import { HomeroomService } from './homeroom.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class NotifyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  studentIds!: string[]

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string
}

@ApiTags('homeroom')
@ApiBearerAuth()
@Feature('homeroom')
@Controller({ path: 'homeroom', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class HomeroomController {
  constructor(private readonly service: HomeroomService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Классы, где я классный руководитель (админу — все классы школы)' })
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user)
  }

  @Get(':groupId/overview')
  @ApiQuery({ name: 'days', required: false })
  @ApiOperation({ summary: 'Сводка по ученикам класса: ДЗ, посещаемость, оценки за N дней' })
  overview(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Query('days') days?: string,
  ) {
    return this.service.overview(user, groupId, days ? Number(days) : 14)
  }

  @Post(':groupId/notify')
  @ApiOperation({ summary: 'Написать родителям выбранных учеников класса' })
  notify(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: NotifyDto,
  ) {
    return this.service.notify(user, groupId, dto.studentIds, dto.text)
  }
}
