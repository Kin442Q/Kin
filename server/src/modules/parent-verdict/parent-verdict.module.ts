import { Module } from '@nestjs/common'

import { ClassAccessModule } from '../class-access/class-access.module'
import { FeaturesModule } from '../features/features.module'
import { ParentVerdictController } from './parent-verdict.controller'
import { ParentVerdictService } from './parent-verdict.service'

/**
 * «Ежемесячный вердикт родителю». Этап 1: расчёт сигналов по правилам, только чтение.
 * Черновики, проверка учителем, доставка и ИИ — следующие этапы.
 */
@Module({
  imports: [ClassAccessModule, FeaturesModule],
  controllers: [ParentVerdictController],
  providers: [ParentVerdictService],
})
export class ParentVerdictModule {}
