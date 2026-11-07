import { Logger } from '@nestjs/common'

import type { AlertSink } from './alert-event'

interface Flushable extends AlertSink {
  flush(timeoutMs?: number): Promise<void>
}

/**
 * Ошибки вне запросов (фоновые задачи, забытый await):
 * - необработанный reject: пишем в лог и в оповещение, сервер продолжает работать (иначе процесс падал бы, а
 *   Railway после 10 перезапусков подряд сдаётся);
 * - uncaughtException: состояние процесса неизвестно — оповещаем, даём письму до 3 секунд уйти и выходим,
 *   Railway перезапустит сервер.
 */
export function installProcessHandlers(alerts: Flushable, proc: NodeJS.Process = process): void {
  const logger = new Logger('Process')

  proc.on('unhandledRejection', (reason) => {
    logger.error(`unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`)
    alerts.report({ source: 'process', error: reason })
  })

  proc.on('uncaughtException', (error) => {
    logger.error(`uncaughtException: ${error instanceof Error ? error.stack : String(error)}`)
    alerts.report({ source: 'process', error })
    void alerts.flush(3000).finally(() => proc.exit(1))
  })
}
