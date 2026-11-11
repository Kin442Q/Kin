import { Controller, ForbiddenException, Get, Param, Post, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'

import { FilesService } from './files.service'
import { describeFile, safeDownloadName } from './file-types'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('files')
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(private readonly service: FilesService) {}

  /**
   * Скачивание по короткой ссылке (5 минут). Ссылку выдают ручки материалов
   * после проверки прав, поэтому сама ручка открыта — браузер и мобильное
   * приложение не могут приложить заголовок Authorization к обычной ссылке.
   */
  @Public()
  @Get('dl/:token')
  @ApiOperation({ summary: 'Скачать файл по временной ссылке' })
  async download(@Param('token') token: string, @Res() res: Response) {
    const { file, stream } = await this.service.openByToken(token)
    const name = safeDownloadName(file.name)
    const ascii = name.replace(/[^\x20-\x7e]/g, '_')
    const inline = describeFile(file.name)?.inline ?? false

    res.setHeader('Content-Type', file.mime)
    res.setHeader('Content-Length', String(file.size))
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    )
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    stream.on('error', () => {
      if (!res.headersSent) res.status(404)
      res.end()
    })
    stream.pipe(res)
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @Get('usage')
  @ApiOperation({ summary: 'Сколько места занято файлами школы и какой лимит' })
  usage(@CurrentUser() user: AuthUser) {
    return this.service.usage(user)
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('cleanup')
  @ApiOperation({ summary: 'Запустить чистку вручную (только владелец платформы)' })
  cleanup(@CurrentUser() user: AuthUser) {
    if (user.kindergartenId) throw new ForbiddenException('Только владелец платформы')
    return this.service.cleanup()
  }
}
