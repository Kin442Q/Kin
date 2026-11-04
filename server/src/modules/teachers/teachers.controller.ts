import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { TeachersService } from './teachers.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'
import { Feature } from '../../common/decorators/feature.decorator'

@ApiTags('teachers')
@ApiBearerAuth()
@Feature('teachers')
@Controller({ path: 'teachers', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user)
  }

  @Patch(':id/group')
  assignGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { groupId: string | null },
  ) {
    return this.service.assignGroup(user, id, body.groupId)
  }

  @Patch(':id/classes')
  setClasses(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { groupIds: string[] },
  ) {
    return this.service.setClasses(user, id, body.groupIds || [])
  }
}
