import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SetMetadata } from '@nestjs/common'

export const GROUP_PARAM_KEY = 'groupParam'

/**
 * Декоратор для указания, где взять id группы для проверки.
 * Чаще всего это URL-параметр `:groupId` или `:id`.
 */
export const GroupScope = (paramName = 'id') => SetMetadata(GROUP_PARAM_KEY, paramName)

/**
 * Гарантирует, что TEACHER читает/пишет только свою группу.
 * SUPER_ADMIN/ADMIN не ограничиваются.
 *
 * Использование:
 *   @UseGuards(JwtAuthGuard, RolesGuard, GroupScopeGuard)
 *   @Roles('SUPER_ADMIN', 'TEACHER')
 *   @GroupScope('id')
 *   @Get(':id/students')
 */
@Injectable()
export class GroupScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    const user = req.user
    if (!user) throw new ForbiddenException('Не авторизован')
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true

    const paramName = this.reflector.get<string>(GROUP_PARAM_KEY, ctx.getHandler()) ?? 'id'
    const groupId =
      req.params?.[paramName] ?? req.query?.[paramName] ?? req.body?.[paramName]

    if (!groupId) {
      throw new ForbiddenException(`Не передан ${paramName}`)
    }
    if (user.role === 'TEACHER' && user.groupId !== groupId) {
      throw new ForbiddenException('Доступ только к своей группе')
    }
    return true
  }
}
