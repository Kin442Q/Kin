import { Module } from '@nestjs/common'

import { AccessModule } from '../access/access.module'
import { MinistryController, ViewersController } from './ministry.controller'
import { MinistryScopeService } from './ministry-scope.service'
import { MinistryService } from './ministry.service'
import { ViewersService } from './viewers.service'

/** Кабинет министерства образования и районных отделов: сводная статистика и учётные записи наблюдателей. PrismaService глобальный. */
@Module({
  imports: [AccessModule],
  controllers: [MinistryController, ViewersController],
  providers: [MinistryScopeService, MinistryService, ViewersService],
})
export class MinistryModule {}
