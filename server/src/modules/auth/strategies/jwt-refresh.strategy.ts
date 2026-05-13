import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import { Request } from 'express'
import type { RefreshJwtPayload } from '../../../common/types/jwt-payload'

/**
 * Стратегия для refresh-token. Токен лежит в httpOnly cookie `refreshToken`.
 * Дополнительно сохраняем raw token в req.refreshToken — нужно AuthService-у
 * для проверки против БД (revoke check + hash-сравнение).
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        const t = req?.cookies?.refreshToken
        return t ?? null
      },
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret')!,
      passReqToCallback: true,
    })
  }

  async validate(req: Request, payload: RefreshJwtPayload) {
    const raw = req?.cookies?.refreshToken
    if (!raw) throw new UnauthorizedException('Refresh token missing')
    return { sub: payload.sub, jti: payload.jti, raw }
  }
}
