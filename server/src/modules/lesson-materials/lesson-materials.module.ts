import { Module } from '@nestjs/common'

import { ClassAccessModule } from '../class-access/class-access.module'
import { FilesModule } from '../files/files.module'
import { LessonMaterialsController } from './lesson-materials.controller'
import { LessonMaterialsService } from './lesson-materials.service'

@Module({
  imports: [ClassAccessModule, FilesModule],
  controllers: [LessonMaterialsController],
  providers: [LessonMaterialsService],
})
export class LessonMaterialsModule {}
