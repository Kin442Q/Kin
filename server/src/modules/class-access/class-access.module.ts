import { Module } from '@nestjs/common'
import { ClassAccessService } from './class-access.service'

@Module({
  providers: [ClassAccessService],
  exports: [ClassAccessService],
})
export class ClassAccessModule {}
