import { Module } from '@nestjs/common'
import { FilesModule } from '../files/files.module'
import { LibraryController } from './library.controller'
import { LibraryService } from './library.service'

@Module({
  imports: [FilesModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
