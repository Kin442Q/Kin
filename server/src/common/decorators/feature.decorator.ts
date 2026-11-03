import { SetMetadata } from '@nestjs/common'
import type { FeatureKey } from '../../modules/features/feature-registry'

export const FEATURE_KEY = 'feature'

/**
 * Привязывает контроллер/ручку к разделу платформы. Если раздел выключен
 * для учреждения пользователя — глобальный FeatureGuard вернёт 403.
 * Владельца платформы (без учреждения) не ограничивает.
 *
 *   @Feature('grades')
 *   @Controller({ path: 'grades', version: '1' })
 */
export const Feature = (key: FeatureKey) => SetMetadata(FEATURE_KEY, key)
