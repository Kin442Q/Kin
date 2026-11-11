import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'

import { LessonMaterialsService } from './lesson-materials.service'
import { CreateLessonMaterialDto } from './lesson-materials.dto'
import { FilesService, type UploadedTempFile } from '../files/files.service'
import { singleFileUpload } from '../files/upload'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

/**
 * Материалы к уроку: учитель выкладывает файл / ссылку / текст для своего
 * класса, ученики и родители видят. Живут 30 дней, дальше удаляются сами.
 */
@ApiTags('lesson-materials')
@ApiBearerAuth()
@Feature('lesson_materials')
@Controller({ path: 'lesson-materials', version: '1' })
@UseGuards(RolesGuard)
export class LessonMaterialsController {
  constructor(
    private readonly service: LessonMaterialsService,
    private readonly files: FilesService,
  ) {}

  @Get()
  @Roles('STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiOperation({ summary: 'Материалы к урокам, доступные пользователю (не истёкшие)' })
  list(@CurrentUser() user: AuthUser, @Query('groupId') groupId?: string, @Query('subjectId') subjectId?: string) {
    return this.service.list(user, { groupId, subjectId })
  }

  @Post()
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Выложить материал классу (файл, ссылка и/или текст)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLessonMaterialDto) {
    return this.service.create(user, dto)
  }

  @Post('upload')
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(singleFileUpload())
  @ApiOperation({ summary: 'Загрузить файл (поле «file»); вернёт id для POST /lesson-materials' })
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedTempFile | undefined) {
    return this.files.upload(user, file)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Удалить материал и его файл (автор или админ школы)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }

  @Get(':id/file-link')
  @Roles('STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Временная ссылка на скачивание файла материала' })
  fileLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.fileLink(user, id)
  }
}
