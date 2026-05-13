import { SetMetadata } from '@nestjs/common'
import type { Role } from '@prisma/client'

export const ROLES_KEY = 'roles'

/**
 * Декоратор, ограничивающий эндпоинт ролями. Применяется вместе с RolesGuard.
 * Пример:
 *   @Roles('SUPER_ADMIN', 'TEACHER')
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
