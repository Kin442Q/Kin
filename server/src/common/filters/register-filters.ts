import type { INestApplication } from '@nestjs/common'

import type { AlertSink } from '../../modules/monitoring/alert-event'
import { AllExceptionsFilter } from './all-exceptions.filter'
import { HttpExceptionFilter } from './http-exception.filter'
import { PrismaExceptionFilter } from './prisma-exception.filter'

/**
 * Глобальные фильтры ошибок. Nest проверяет их с конца, поэтому общий (@Catch() — ловит всё) идёт первым:
 * он срабатывает, только если не подошёл ни один из точных.
 */
export function registerExceptionFilters(app: INestApplication, alerts?: AlertSink): void {
  app.useGlobalFilters(new AllExceptionsFilter(alerts), new HttpExceptionFilter(alerts), new PrismaExceptionFilter(alerts))
}
