import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Request, Response } from 'express'

import { AlertSink, requestContext } from '../../modules/monitoring/alert-event'

/**
 * Превращает Prisma-ошибки в HTTP-ответы. Самые частые коды:
 *   P2002 — unique violation → 409
 *   P2025 — not found        → 404
 *   P2003 — foreign key      → 409
 * Остальные коды (например P2021/P2022 — нет таблицы или колонки, то есть миграция не применена) отдаются как 400,
 * но это поломка сервера, а не ошибка пользователя, поэтому они попадают в лог и в оповещения.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaExceptionFilter')

  constructor(private readonly alerts?: AlertSink) {}

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    const map: Record<string, { status: number; message: string }> = {
      P2002: { status: HttpStatus.CONFLICT, message: 'Запись с такими данными уже существует' },
      P2025: { status: HttpStatus.NOT_FOUND, message: 'Запись не найдена' },
      P2003: { status: HttpStatus.CONFLICT, message: 'Нарушение связи' },
    }
    const known = map[exception.code]
    const m = known ?? {
      status: HttpStatus.BAD_REQUEST,
      message: 'Ошибка базы данных',
    }

    if (!known) {
      const req = ctx.getRequest<Request>()
      this.logger.error(`${req.method} ${req.originalUrl ?? req.url} → база данных ${exception.code}`, exception.stack)
      this.alerts?.report({
        source: 'http',
        status: m.status,
        label: 'Ошибка базы данных',
        ...requestContext(req),
        error: exception,
      })
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
