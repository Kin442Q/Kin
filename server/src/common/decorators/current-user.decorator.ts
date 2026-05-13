import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthUser } from '../types/jwt-payload'

/**
 * Достаёт залогиненного пользователя из request.
 * Используется в контроллерах:
 *   findAll(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest()
    return data ? req.user?.[data] : (req.user as AuthUser)
  },
)
