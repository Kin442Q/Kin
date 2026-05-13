import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable, map } from 'rxjs'

/**
 * Унифицирует success-ответы: { data, meta? }. Если контроллер уже возвращает
 * { data, meta }, оставляем как есть.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          ('data' in (payload as object) || 'meta' in (payload as object))
        ) {
          return payload
        }
        return { data: payload }
      }),
    )
  }
}
