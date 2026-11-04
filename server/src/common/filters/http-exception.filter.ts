import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

/**
 * Глобальный фильтр для всех HttpException. Формирует одинаковый JSON,
 * чтобы фронт знал, что приходит.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter')

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const status = exception.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR
    const payload = exception.getResponse() as
      | string
      | { message: string | string[]; error?: string; code?: string; feature?: string }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, exception.stack)
    }

    res.status(status).json({
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      message:
        typeof payload === 'string'
          ? payload
          : Array.isArray(payload.message)
            ? payload.message.join(', ')
            : payload.message,
      // Машиночитаемый код (например FEATURE_DISABLED) — фронт по нему
      // отличает «раздел выключен» от обычного 403.
      ...(typeof payload === 'object' && payload.code
        ? { code: payload.code, ...(payload.feature ? { feature: payload.feature } : {}) }
        : {}),
    })
  }
}
