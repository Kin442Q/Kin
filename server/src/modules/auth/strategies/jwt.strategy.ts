import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtPayload, AuthUser } from '../../../common/types/jwt-payload'
import { RedisService } from '../../../infrastructure/redis/redis.service'

/**
 * Стратегия для access-token. Проверяет, что токен не в blacklist (Redis),
 * иначе считаем его отозванным (logout, password change).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly redis: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
      passReqToCallback: true,
    })
  }

  async validate(req: any, payload: JwtPayload & { jti?: string }): Promise<AuthUser> {
    if (payload.jti) {
      const blacklisted = await this.redis.client.exists(`jwt:blacklist:${payload.jti}`)
      if (blacklisted) throw new UnauthorizedException('Токен отозван')
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      kindergartenId: payload.kindergartenId ?? null,
      groupId: payload.groupId ?? null,
      childId: payload.childId ?? null,
    }
  }
}
