import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { FEATURE_KEY } from '../../common/decorators/feature.decorator'
import { FEATURES, type FeatureKey } from './feature-registry'
import { FeaturesService } from './features.service'

/**
 * Глобальный guard: пускает на ручку с @Feature('x') только если раздел
 * включён для учреждения пользователя. Выполняется после JwtAuthGuard
 * (нужен req.user). Ручки без @Feature и публичные не затрагивает.
 * Владельца платформы (kindergartenId = null) не ограничивает.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeaturesService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const keys = this.reflector.getAllAndOverride<FeatureKey[] | undefined>(FEATURE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!keys?.length) return true

    const user = ctx.switchToHttp().getRequest().user
    if (!user?.kindergartenId) return true

    // Нужны все перечисленные разделы; сообщаем о первом выключенном.
    for (const key of keys) {
      if (await this.features.isEnabled(user.kindergartenId, key)) continue
      throw new ForbiddenException({
        message: `Раздел «${FEATURES[key]?.label ?? key}» отключён для вашего учреждения`,
        code: 'FEATURE_DISABLED',
        feature: key,
      })
    }
    return true
  }
}
