import type { Role } from '@prisma/client'

/** Содержимое access-token. */
export interface JwtPayload {
  sub: string
  email: string
  role: Role
  /** Для TEACHER */
  groupId?: string | null
  /** Для PARENT */
  childId?: string | null
}

/** Содержимое refresh-token (минимум для ротации). */
export interface RefreshJwtPayload {
  sub: string
  jti: string
}

/** То, что доступно в request.user после JwtAuthGuard. */
export interface AuthUser extends JwtPayload {}
