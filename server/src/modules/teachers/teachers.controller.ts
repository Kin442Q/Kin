import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { TeachersService } from './teachers.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'

@ApiTags('teachers')
@ApiBearerAuth()
@Controller({ path: 'teachers', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Patch(':id/group')
  assignGroup(@Param('id') id: string, @Body() body: { groupId: string | null }) {
    return this.service.assignGroup(id, body.groupId)
  }
}
