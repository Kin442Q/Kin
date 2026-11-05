import { Module } from '@nestjs/common'
import { StaffService } from './staff.service'
import { StaffController } from './staff.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { AccessModule } from '../access/access.module'

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
