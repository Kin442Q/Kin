import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { GroupsService } from './groups.service'
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { GroupScope, GroupScopeGuard } from '../../common/guards/group-scope.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('groups')
@ApiBearerAuth()
@Controller({ path: 'groups', version: '1' })
@UseGuards(RolesGuard)
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Список групп (TEACHER видит только свою)' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user)
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @UseGuards(GroupScopeGuard)
  @GroupScope('id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() dto: CreateGroupDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
