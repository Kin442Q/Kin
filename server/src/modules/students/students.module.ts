import { Module } from '@nestjs/common'
import { StudentsController } from './students.controller'
import { StudentsService } from './students.service'
import { StudentsBulkDeleteService } from './students-bulk-delete.service'
import { StudentLinksModule } from '../student-links/student-links.module'
import { AccessModule } from '../access/access.module'

@Module({
  imports: [StudentLinksModule, AccessModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentsBulkDeleteService],
  exports: [StudentsService],
})
export class StudentsModule {}
