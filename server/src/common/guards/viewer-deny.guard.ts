import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { ALLOW_VIEWER_KEY, type AllowViewerOptions } from '../decorators/allow-viewer.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

/**
 * Глобальный guard «запрещено всё, кроме разрешённого» для наблюдателей (роль VIEWER).
 *
 * У наблюдателя нет школы (kindergartenId = null), а около двух десятков мест в коде читают это как
 * «владелец платформы, видит все школы». Поэтому полагаться на то, что каждая ручка сама откажет
 * новой роли, нельзя: одна забытая проверка открыла бы данные всех школ. Здесь доступ перевёрнут:
 * наблюдатель проходит только туда, где стоит @AllowViewer(), и только на чтение (запись — лишь там,
 * где явно указано `write: true`, то есть в /auth).
 *
 * Выполняется после JwtAuthGuard (нужен req.user). Остальных пользователей не затрагивает.
 */
@Injectable()
export class ViewerDenyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    if (req.user?.role !== 'VIEWER') return true

    const targets = [ctx.getHandler(), ctx.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true

    const grant = this.reflector.getAllAndOverride<AllowViewerOptions | undefined>(ALLOW_VIEWER_KEY, targets)
    if (!grant) throw new ForbiddenException('Этот раздел недоступен для роли «Наблюдатель»')

    const method = String(req.method || 'GET').toUpperCase()
    const readOnly = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
    if (!readOnly && !grant.write) {
      throw new ForbiddenException('Наблюдатель может только просматривать данные')
    }
    return true
  }
}
