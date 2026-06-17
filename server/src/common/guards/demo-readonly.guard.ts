import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'

/**
 * Блокирует любые изменения данных для пользователей демо-учреждения
 * («живое демо» на лендинге). Выполняется ПОСЛЕ JwtAuthGuard, поэтому
 * у нас уже есть req.user с флагом isDemo (из access-токена).
 *
 * GET/HEAD/OPTIONS — разрешены. POST/PUT/PATCH/DELETE — запрещены,
 * кроме /auth/* (чтобы демо-пользователь мог выйти / обновить токен).
 */
@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    const user = req.user
    if (!user?.isDemo) return true

    const method = String(req.method || 'GET').toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true
    }

    const url: string = req.originalUrl || req.url || ''
    if (url.includes('/auth/')) return true

    throw new ForbiddenException(
      'Демо-режим: изменение данных отключено. Зарегистрируйтесь для полного доступа.',
    )
  }
}
