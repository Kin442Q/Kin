import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Request, Response } from 'express'

import { AlertSink, requestContext } from '../../modules/monitoring/alert-event'

/**
 * Последний рубеж: всё, что не поймали остальные фильтры (TypeError в коде, падение Prisma или Redis, любая
 * неожиданная ошибка). Пользователь получает один и тот же аккуратный 500 без деталей, а ошибка попадает в лог
 * и в письмо-оповещение. Регистрировать нужно ПЕРВЫМ: Nest проверяет фильтры с конца, и общий должен быть
 * проверен последним.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter')

  constructor(private readonly alerts?: AlertSink) {}

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception))
      return
    }
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    // Ошибки с кодом 4xx от промежуточных слоёв (например слишком большое тело запроса) — это не поломка сервера.
    const status = clientErrorStatus(exception)
    if (status) {
      if (!res.headersSent) {
        res.status(status).json({
          statusCode: status,
          path: pathOf(req),
          timestamp: new Date().toISOString(),
          message: (exception as { message?: string }).message || 'Некорректный запрос',
        })
      }
      return
    }

    this.logger.error(`${req.method} ${req.originalUrl ?? req.url} → 500`, exception instanceof Error ? exception.stack : String(exception))
    this.alerts?.report({
      source: 'http',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      ...requestContext(req),
      error: exception,
    })

    if (res.headersSent) return
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      path: pathOf(req),
      timestamp: new Date().toISOString(),
      message: 'Внутренняя ошибка сервера',
    })
  }
}

/** Путь без query: в теле ответа не повторяем параметры запроса (в них бывают токены). */
function pathOf(req: Request): string {
  return (req.url ?? '').split('?')[0]
}

function clientErrorStatus(exception: unknown): number | null {
  if (exception instanceof HttpException) return null
  const e = exception as { status?: unknown; statusCode?: unknown } | null
  const status = typeof e?.status === 'number' ? e.status : typeof e?.statusCode === 'number' ? e.statusCode : null
  return status !== null && status >= 400 && status < 500 ? status : null
}
