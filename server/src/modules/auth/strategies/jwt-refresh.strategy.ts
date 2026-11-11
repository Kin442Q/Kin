import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import { Request } from 'express'
import type { RefreshJwtPayload } from '../../../common/types/jwt-payload'

/**
 * Refresh-токен: сайт хранит его в httpOnly cookie `refreshToken`, мобильное приложение cookie
 * не использует и присылает токен в теле запроса (`{ refreshToken }`).
 */
export function refreshTokenFrom(req: Request | undefined): string | null {
  const cookie = req?.cookies?.refreshToken
  if (typeof cookie === 'string' && cookie) return cookie
  const body = (req?.body as { refreshToken?: unknown } | undefined)?.refreshToken
  return typeof body === 'string' && body ? body : null
}

/**
 * Стратегия для refresh-token. Токен лежит в httpOnly cookie `refreshToken` (сайт) или в теле запроса
 * (мобильное приложение). Дополнительно сохраняем raw token в req.user — нужно AuthService-у
 * для проверки против БД (revoke check + hash-сравнение).
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => refreshTokenFrom(req),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret')!,
      passReqToCallback: true,
    })
  }

  async validate(req: Request, payload: RefreshJwtPayload) {
    const raw = refreshTokenFrom(req)
    if (!raw) throw new UnauthorizedException('Refresh token missing')
    return { sub: payload.sub, jti: payload.jti, raw }
  }
}
