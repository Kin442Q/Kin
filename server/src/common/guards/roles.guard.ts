import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@prisma/client'
import { ROLES_KEY } from '../decorators/roles.decorator'

/**
 * Сравнивает роль пользователя с требуемыми ролями эндпоинта.
 * Если декоратор @Roles(...) не задан — пропускает всех.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!required?.length) return true

    const { user } = ctx.switchToHttp().getRequest()
    if (!user) throw new ForbiddenException('Не авторизован')

    if (!required.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав')
    }
    return true
  }
}
