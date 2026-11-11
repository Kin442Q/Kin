import { HttpException } from '@nestjs/common'
import type { Request } from 'express'

import { scrubPath, scrubText } from './scrub'

/** Что именно случилось и где. Тело запроса, заголовки и query сюда не попадают. */
export interface AlertEvent {
  /** http — ошибка при обработке запроса; process — необработанная ошибка вне запроса. */
  source: 'http' | 'process'
  status?: number
  /** Короткое название для темы письма, если одного кода ответа мало («Ошибка базы данных»). */
  label?: string
  method?: string
  /** Шаблон маршрута (`/api/v1/students/:id`) или очищенный путь. */
  route?: string
  userId?: string
  role?: string
  error: unknown
}

/** Куда фильтры ошибок отправляют серьёзные случаи. Реализация не должна бросать исключения. */
export interface AlertSink {
  report(event: AlertEvent): void
}

export interface DescribedError {
  name: string
  message: string
  code?: string
  /** Первые строки стека (`at …`). */
  stack: string[]
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/** Для HttpException суть часто лежит в теле ответа (например, у проверки готовности: `{ error: { redis: down } }`). */
function httpExceptionMessage(error: HttpException): string {
  const body = error.getResponse()
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; error?: unknown }
    if (typeof b.message === 'string') return b.message
    if (Array.isArray(b.message)) return b.message.join(', ')
    if (b.error && typeof b.error === 'object') return `${error.message}: ${safeJson(b.error)}`
    return `${error.message}: ${safeJson(body)}`
  }
  return error.message
}

export function describeError(error: unknown): DescribedError {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code
    let message = error instanceof HttpException ? httpExceptionMessage(error) : error.message
    // Сообщение Prisma начинается с вызова вместе со значениями (имена, почта…): оставляем только суть — последнюю строку.
    if (error.name.startsWith('PrismaClient')) {
      const lines = message.split('\n').map((l) => l.trim()).filter(Boolean)
      message = lines[lines.length - 1] ?? message
    }
    return {
      name: error.name,
      message: scrubText(message),
      code: typeof code === 'string' ? code : undefined,
      stack: (error.stack ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('at '))
        .slice(0, 6),
    }
  }
  let text: string
  try {
    text = typeof error === 'string' ? error : JSON.stringify(error)
  } catch {
    text = String(error)
  }
  return { name: 'NonError', message: scrubText(text ?? 'undefined'), stack: [] }
}

/** Метод, маршрут и пользователь из запроса Express — только то, что безопасно показать в письме. */
export function requestContext(req: Request): Pick<AlertEvent, 'method' | 'route' | 'userId' | 'role'> {
  const routePath = (req as { route?: { path?: unknown } }).route?.path
  const user = (req as { user?: { sub?: unknown; role?: unknown } }).user
  return {
    method: req.method,
    route:
      typeof routePath === 'string'
        ? `${req.baseUrl ?? ''}${routePath}`
        : scrubPath(req.originalUrl ?? req.url ?? ''),
    userId: typeof user?.sub === 'string' ? user.sub : undefined,
    role: typeof user?.role === 'string' ? user.role : undefined,
  }
}
