import { Global, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { ParentVerdictModule } from './parent-verdict.module'
import { ParentVerdictController } from './parent-verdict.controller'
import { ParentVerdictService } from './parent-verdict.service'
import { VerdictConfigService } from './verdict-config.service'
import { VerdictDraftsService } from './verdict-drafts.service'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock } from '../../test-utils/prisma-mock'

/** В приложении PrismaService даёт глобальный модуль; здесь подставляем мок. */
@Global()
@Module({ providers: [{ provide: PrismaService, useValue: createPrismaMock() }], exports: [PrismaService] })
class PrismaTestModule {}

describe('ParentVerdictModule', () => {
  it('собирается: все зависимости контроллера и сервисов находятся (ClassAccess, Features, Prisma)', async () => {
    const ref = await Test.createTestingModule({ imports: [PrismaTestModule, ParentVerdictModule] }).compile()
    expect(ref.get(ParentVerdictController)).toBeInstanceOf(ParentVerdictController)
    expect(ref.get(ParentVerdictService)).toBeInstanceOf(ParentVerdictService)
    expect(ref.get(VerdictConfigService)).toBeInstanceOf(VerdictConfigService)
    expect(ref.get(VerdictDraftsService)).toBeInstanceOf(VerdictDraftsService)
    await ref.close()
  })
})
