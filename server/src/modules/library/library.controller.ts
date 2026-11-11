import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'

import { LibraryService } from './library.service'
import { FilesService, type UploadedTempFile } from '../files/files.service'
import { singleFileUpload } from '../files/upload'
import { CreateLibraryItemDto, LIBRARY_TYPES, UpdateLibraryItemDto, type LibraryType } from './library.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('library')
@ApiBearerAuth()
@Feature('library')
@Controller({ path: 'library', version: '1' })
@UseGuards(RolesGuard)
export class LibraryController {
  constructor(
    private readonly service: LibraryService,
    private readonly files: FilesService,
  ) {}

  @Get()
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiQuery({ name: 'type', required: false, enum: LIBRARY_TYPES })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'gradeNumber', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiOperation({ summary: 'Материалы библиотеки школы (поиск и фильтры)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('subjectId') subjectId?: string,
    @Query('gradeNumber') gradeNumber?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list(user, {
      type: (LIBRARY_TYPES as readonly string[]).includes(type ?? '') ? (type as LibraryType) : undefined,
      subjectId,
      gradeNumber: gradeNumber ? Number(gradeNumber) || undefined : undefined,
      q,
    })
  }

  @Post()
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLibraryItemDto) {
    return this.service.create(user, dto)
  }

  @Post('upload')
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(singleFileUpload())
  @ApiOperation({ summary: 'Загрузить файл (поле «file»); вернёт id для POST /library' })
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedTempFile | undefined) {
    return this.files.upload(user, file)
  }

  @Get(':id/file-link')
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Временная ссылка на скачивание файла материала' })
  fileLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.fileLink(user, id)
  }

  @Patch(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Изменить материал (автор или админ школы)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLibraryItemDto) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
