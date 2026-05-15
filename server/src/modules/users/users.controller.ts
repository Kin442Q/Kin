import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import type { AuthUser } from '../../common/types/jwt-payload'

interface RequestWithUser {
  user: AuthUser
}

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Список всех пользователей садика' })
  list(@Req() req: RequestWithUser) {
    return this.service.list({ kindergartenId: req.user.kindergartenId })
  }

  @Get('teachers')
  @ApiOperation({ summary: 'Список учителей садика' })
  listTeachers(@Req() req: RequestWithUser) {
    return this.service.listTeachers({
      kindergartenId: req.user.kindergartenId,
    })
  }

  @Post('teacher')
  @ApiOperation({ summary: 'Создать учителя (от имени SUPER_ADMIN/ADMIN)' })
  createTeacher(
    @Req() req: RequestWithUser,
    @Body()
    dto: {
      fullName: string
      phone: string
      email?: string
      password: string
      groupId?: string
    },
  ) {
    return this.service.createTeacher(
      { kindergartenId: req.user.kindergartenId },
      dto,
    )
  }

  @Patch('teacher/:id')
  @ApiOperation({ summary: 'Обновить учителя' })
  updateTeacher(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body()
    dto: {
      fullName?: string
      phone?: string
      email?: string
      password?: string
      groupId?: string | null
    },
  ) {
    return this.service.updateTeacher(
      { kindergartenId: req.user.kindergartenId },
      id,
      dto,
    )
  }

  @Delete('teacher/:id')
  @ApiOperation({ summary: 'Удалить учителя' })
  deleteTeacher(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.service.deleteTeacher(
      { kindergartenId: req.user.kindergartenId },
      id,
    )
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Активировать/деактивировать пользователя' })
  setActive(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.service.setActive(
      { kindergartenId: req.user.kindergartenId },
      id,
      body.isActive,
    )
  }
}
