import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Response } from 'express'

/**
 * Превращает Prisma-ошибки в HTTP-ответы. Самые частые коды:
 *   P2002 — unique violation → 409
 *   P2025 — not found        → 404
 *   P2003 — foreign key      → 409
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    const map: Record<string, { status: number; message: string }> = {
      P2002: { status: HttpStatus.CONFLICT, message: 'Запись с такими данными уже существует' },
      P2025: { status: HttpStatus.NOT_FOUND, message: 'Запись не найдена' },
      P2003: { status: HttpStatus.CONFLICT, message: 'Нарушение связи' },
    }
    const m = map[exception.code] ?? {
      status: HttpStatus.BAD_REQUEST,
      message: 'Ошибка базы данных',
    }

    res.status(m.status).json({
      statusCode: m.status,
      code: exception.code,
      message: m.message,
      meta: exception.meta,
      timestamp: new Date().toISOString(),
    })
  }
}
