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
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'

import { MeetingsService } from './meetings.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class CreateMeetingDto {
  @IsString() groupId!: string
  @IsString() @MaxLength(200) title!: string
  @IsDateString() scheduledAt!: string
  @IsOptional() @IsString() @MaxLength(200) location?: string
  @IsOptional() @IsString() @MaxLength(2000) description?: string
}

class UpdateMeetingDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string
  @IsOptional() @IsDateString() scheduledAt?: string
  @IsOptional() @IsString() @MaxLength(200) location?: string
  @IsOptional() @IsString() @MaxLength(2000) description?: string
}

@ApiTags('meetings')
@ApiBearerAuth()
@Controller({ path: 'meetings', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Get()
  @ApiOperation({ summary: 'Список родительских собраний' })
  @ApiQuery({ name: 'groupId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('groupId') groupId?: string) {
    return this.service.list(user, { groupId })
  }

  @Post()
  @ApiOperation({
    summary:
      'Создать родительское собрание и разослать Telegram-уведомления родителям группы',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMeetingDto) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
