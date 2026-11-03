import { SetMetadata } from '@nestjs/common'
import type { FeatureKey } from '../../modules/features/feature-registry'

export const FEATURE_KEY = 'feature'

/**
 * Привязывает контроллер/ручку к разделам платформы. Если хотя бы один раздел
 * выключен для учреждения пользователя — глобальный FeatureGuard вернёт 403.
 * Владельца платформы (без учреждения) не ограничивает.
 * @Feature на ручке ПЕРЕКРЫВАЕТ @Feature на классе (не складывается с ним).
 *
 *   @Feature('grades')
 *   @Controller({ path: 'grades', version: '1' })
 *
 *   @Feature('portal', 'homework')   // нужны оба раздела
 */
export const Feature = (...keys: FeatureKey[]) => SetMetadata(FEATURE_KEY, keys)
