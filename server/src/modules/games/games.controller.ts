import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'

import { GamesService, SubmitScoreDto } from './games.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('games')
@ApiBearerAuth()
@Feature('games')
@Controller({ path: 'games', version: '1' })
@UseGuards(RolesGuard)
export class GamesController {
  constructor(private readonly service: GamesService) {}

  @Get()
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Игры; ученику — его лучший результат в каждой' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user)
  }

  @Post(':key/scores')
  @Roles('STUDENT')
  @Feature('portal', 'games')
  @ApiOperation({ summary: 'Сохранить результат игры: { score, level? }' })
  submit(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: SubmitScoreDto) {
    return this.service.submit(user, key, dto)
  }

  @Get(':key/leaderboard')
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiQuery({ name: 'groupId', required: false })
  @ApiOperation({ summary: 'Рейтинг класса по игре (ученику — его класс, сотруднику — groupId)' })
  leaderboard(@CurrentUser() user: AuthUser, @Param('key') key: string, @Query('groupId') groupId?: string) {
    return this.service.leaderboard(user, key, groupId)
  }
}
