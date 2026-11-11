import { Module } from '@nestjs/common'
import { KindergartensService } from './kindergartens.service'
import { KindergartensController } from './kindergartens.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { FilesModule } from '../files/files.module'

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [KindergartensController],
  providers: [KindergartensService],
})
export class KindergartensModule {}
