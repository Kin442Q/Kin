import { Module } from '@nestjs/common'

import { ClassAccessModule } from '../class-access/class-access.module'
import { FeaturesModule } from '../features/features.module'
import { ParentVerdictController } from './parent-verdict.controller'
import { ParentVerdictService } from './parent-verdict.service'
import { VerdictConfigService } from './verdict-config.service'
import { VerdictDraftsService } from './verdict-drafts.service'

/**
 * «Ежемесячный вердикт родителю».
 * Этап 1: расчёт сигналов по правилам (только чтение).
 * Этап 2: черновики на русском и таджикском, проверка классным руководителем, пороги школы.
 * Дальше: публикация родителю (экран в приложении + push), ИИ как переписчик цифр.
 */
@Module({
  imports: [ClassAccessModule, FeaturesModule],
  controllers: [ParentVerdictController],
  providers: [ParentVerdictService, VerdictConfigService, VerdictDraftsService],
})
export class ParentVerdictModule {}
