import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

import { ParentVerdictService } from './parent-verdict.service'
import { VerdictDraftsService } from './verdict-drafts.service'
import { VerdictConfigService } from './verdict-config.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MONTH_MESSAGE = 'Укажите месяц в формате ГГГГ-ММ'

export class PreviewVerdictQuery {
  @IsString()
  @MinLength(1)
  groupId!: string

  @Matches(MONTH_RE, { message: MONTH_MESSAGE })
  month!: string
}

export class GenerateVerdictDto {
  @IsString()
  @MinLength(1)
  groupId!: string

  @Matches(MONTH_RE, { message: MONTH_MESSAGE })
  month!: string
}

export class UpdateVerdictTextDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  textRu?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  textTg?: string
}

export class SkipVerdictDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

export class UpdateVerdictConfigDto {
  /** Только изменённые пороги: {ключ: число}. Пустой объект — вернуть значения по умолчанию. */
  @IsObject()
  overrides!: Record<string, unknown>
}

/**
 * «Ежемесячный вердикт родителю»: расчёт сигналов, черновики и их проверка классным руководителем.
 * Родителям эти ручки недоступны; публикация родителю — отдельный этап.
 */
@ApiTags('parent-verdict')
@ApiBearerAuth()
@Feature('parent_verdict', 'grades')
@Controller({ path: 'parent-verdict', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class ParentVerdictController {
  constructor(
    private readonly service: ParentVerdictService,
    private readonly drafts: VerdictDraftsService,
    private readonly config: VerdictConfigService,
  ) {}

  @Get('preview')
  @ApiOperation({ summary: 'Сигналы вердикта по классу за месяц (только чтение, ничего не сохраняется)' })
  preview(@CurrentUser() user: AuthUser, @Query() q: PreviewVerdictQuery) {
    return this.service.preview(user, q.groupId, q.month)
  }

  // ── пороги школы (директор); объявлены раньше «:id», чтобы «config» не принимался за id ──

  @Get('config')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Пороги вердикта школы: по умолчанию, изменённые и действующие' })
  getConfig(@CurrentUser() user: AuthUser) {
    return this.config.get(user)
  }

  @Put('config')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Сохранить пороги вердикта школы (пустой объект — по умолчанию)' })
  putConfig(@CurrentUser() user: AuthUser, @Body() dto: UpdateVerdictConfigDto) {
    return this.config.put(user, dto.overrides)
  }

  // ── черновики ──

  @Post('generate')
  @ApiOperation({ summary: 'Создать или обновить черновики класса за месяц (правленые и проверенные не трогает)' })
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateVerdictDto) {
    return this.drafts.generate(user, dto.groupId, dto.month)
  }

  @Get()
  @ApiOperation({ summary: 'Вердикты класса за месяц и ученики без вердикта' })
  list(@CurrentUser() user: AuthUser, @Query() q: PreviewVerdictQuery) {
    return this.drafts.list(user, q.groupId, q.month)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Вердикт целиком, со снимком расчёта' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.drafts.get(user, id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Поправить текст черновика (русский и/или таджикский)' })
  updateText(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVerdictTextDto) {
    return this.drafts.updateText(user, id, dto)
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Одобрить черновик (родителю ничего не уходит)' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.drafts.approve(user, id)
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Вернуть одобренный или пропущенный вердикт в черновик' })
  reopen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.drafts.reopen(user, id)
  }

  @Post(':id/skip')
  @ApiOperation({ summary: 'Не отправлять родителю в этом месяце' })
  skip(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SkipVerdictDto) {
    return this.drafts.skip(user, id, dto.reason)
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Пересчитать черновик заново (правки учителя пропадают)' })
  regenerate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.drafts.regenerate(user, id)
  }
}
