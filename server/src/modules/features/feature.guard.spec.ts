import { ForbiddenException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { FeatureGuard } from './feature.guard'
import { Feature } from '../../common/decorators/feature.decorator'
import type { FeaturesService } from './features.service'

@Feature('grades')
class GradesLikeController {
  open() {
    return 1
  }

  @Feature('payments')
  overridden() {
    return 2
  }
}

class PlainController {
  anything() {
    return 3
  }
}

function ctx(
  cls: new () => object,
  method: string,
  user: unknown,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => (cls.prototype as Record<string, () => unknown>)[method],
    getClass: () => cls,
  } as unknown as ExecutionContext
}

describe('FeatureGuard', () => {
  let features: { isEnabled: jest.Mock }
  let guard: FeatureGuard

  beforeEach(() => {
    features = { isEnabled: jest.fn() }
    guard = new FeatureGuard(new Reflector(), features as unknown as FeaturesService)
  })

  it('ручка без @Feature не проверяется', async () => {
    await expect(guard.canActivate(ctx(PlainController, 'anything', { kindergartenId: 'k1' }))).resolves.toBe(true)
    expect(features.isEnabled).not.toHaveBeenCalled()
  })

  it('владелец платформы (без учреждения) проходит всегда', async () => {
    await expect(guard.canActivate(ctx(GradesLikeController, 'open', { kindergartenId: null }))).resolves.toBe(true)
    expect(features.isEnabled).not.toHaveBeenCalled()
  })

  it('нет пользователя (публичная ручка) — не блокирует', async () => {
    await expect(guard.canActivate(ctx(GradesLikeController, 'open', undefined))).resolves.toBe(true)
  })

  it('раздел включён — пропускает; ключ берётся с класса', async () => {
    features.isEnabled.mockResolvedValue(true)
    await expect(guard.canActivate(ctx(GradesLikeController, 'open', { kindergartenId: 'k1' }))).resolves.toBe(true)
    expect(features.isEnabled).toHaveBeenCalledWith('k1', 'grades')
  })

  it('раздел выключен — 403 с кодом FEATURE_DISABLED', async () => {
    features.isEnabled.mockResolvedValue(false)
    const err = await guard
      .canActivate(ctx(GradesLikeController, 'open', { kindergartenId: 'k1' }))
      .catch((e) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err.getResponse()).toMatchObject({ code: 'FEATURE_DISABLED', feature: 'grades' })
  })

  it('@Feature на ручке перекрывает @Feature на классе', async () => {
    features.isEnabled.mockResolvedValue(true)
    await guard.canActivate(ctx(GradesLikeController, 'overridden', { kindergartenId: 'k1' }))
    expect(features.isEnabled).toHaveBeenCalledWith('k1', 'payments')
  })
})

@Feature('portal', 'homework')
class StudentLikeController {
  list() {
    return 4
  }
}

describe('FeatureGuard — несколько разделов', () => {
  let features: { isEnabled: jest.Mock }
  let guard: FeatureGuard

  beforeEach(() => {
    features = { isEnabled: jest.fn() }
    guard = new FeatureGuard(new Reflector(), features as unknown as FeaturesService)
  })

  it('пускает, только если включены ВСЕ разделы', async () => {
    features.isEnabled.mockResolvedValue(true)
    await expect(guard.canActivate(ctx(StudentLikeController, 'list', { kindergartenId: 'k1' }))).resolves.toBe(true)
    expect(features.isEnabled).toHaveBeenCalledWith('k1', 'portal')
    expect(features.isEnabled).toHaveBeenCalledWith('k1', 'homework')
  })

  it('403 на первом выключенном разделе (в ответе его ключ)', async () => {
    features.isEnabled.mockImplementation(async (_k: string, key: string) => key !== 'homework')
    const err = await guard
      .canActivate(ctx(StudentLikeController, 'list', { kindergartenId: 'k1' }))
      .catch((e) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err.getResponse()).toMatchObject({ code: 'FEATURE_DISABLED', feature: 'homework' })
  })
})
