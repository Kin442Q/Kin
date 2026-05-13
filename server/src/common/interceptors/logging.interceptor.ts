import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable, tap } from 'rxjs'

/**
 * Лёгкий логгер: метод, URL, время выполнения. nestjs-pino пишет более
 * подробные http-логи, этот интерсептор полезен для метрик длительности
 * хендлеров и единого формата.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest()
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start
        this.logger.log(`${req.method} ${req.originalUrl ?? req.url} ${ms}ms`)
      }),
    )
  }
}
