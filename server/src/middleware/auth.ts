import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-prod'

export interface AuthedRequest extends Request {
  user?: { id: string; role: Role; email: string }
}

/** Проверяет JWT в заголовке Authorization: Bearer <token>. */
export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Не авторизован' })
  }
  try {
    const token = header.slice('Bearer '.length)
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; role: Role; email: string }
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ message: 'Невалидный токен' })
  }
}

/** Ограничивает доступ ролями. Использовать после authMiddleware. */
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Не авторизован' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Нет доступа' })
    }
    next()
  }
}

export function signToken(payload: { id: string; role: Role; email: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
