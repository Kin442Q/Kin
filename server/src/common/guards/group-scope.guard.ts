import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SetMetadata } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'

export const GROUP_PARAM_KEY = 'groupParam'

/**
 * Декоратор для указания, где взять id группы для проверки.
 * Чаще всего это URL-параметр `:groupId` или `:id`.
 */
export const GroupScope = (paramName = 'id') => SetMetadata(GROUP_PARAM_KEY, paramName)

/**
 * Гарантирует, что TEACHER читает/пишет только свои классы:
 * основную группу (User.groupId) ИЛИ любой из классов, которые он ведёт
 * (User.teachingGroups). SUPER_ADMIN/ADMIN не ограничиваются.
 *
 * Использование:
 *   @UseGuards(JwtAuthGuard, RolesGuard, GroupScopeGuard)
 *   @Roles('SUPER_ADMIN', 'TEACHER')
 *   @GroupScope('id')
 *   @Get(':id/students')
 */
@Injectable()
export class GroupScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
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
    if (user.role === 'TEACHER') {
      // Основной класс есть в токене — это быстрый путь без запроса в БД.
      if (user.groupId === groupId) return true
      // Остальные классы учителя (M:N) в токен не кладём — они меняются
      // админом, токен живёт до 15 минут. Проверяем по БД.
      const teaches = await this.prisma.user.count({
        where: { id: user.sub, teachingGroups: { some: { id: groupId } } },
      })
      if (teaches === 0) throw new ForbiddenException('Доступ только к своему классу')
    }
    return true
  }
}
