import { Module } from '@nestjs/common'
import { KindergartensService } from './kindergartens.service'
import { KindergartensController } from './kindergartens.controller'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [KindergartensController],
  providers: [KindergartensService],
})
export class KindergartensModule {}
