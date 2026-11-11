import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { Queue } from 'bullmq'

import { QUEUE_FILES_CLEANUP } from '../../infrastructure/bullmq/bull.module'
import { FilesService } from './files.service'

/** Каждую ночь в 03:00 (время сервера). */
export const CLEANUP_CRON = '0 3 * * *'

/** Воркер: выполняет чистку (истёкшие материалы и забытые загрузки). */
@Processor(QUEUE_FILES_CLEANUP)
export class FilesCleanupProcessor extends WorkerHost {
  constructor(private readonly files: FilesService) {
    super()
  }

  async process(): Promise<{ materials: number; files: number }> {
    return this.files.cleanup()
  }
}

/**
 * Ставит ежедневное повторяющееся задание в очередь. jobId фиксирован, поэтому
 * при перезапусках и нескольких экземплярах сервера задание не дублируется.
 */
@Injectable()
export class FilesCleanupScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(FilesCleanupScheduler.name)

  constructor(@InjectQueue(QUEUE_FILES_CLEANUP) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.queue.add('daily', {}, { repeat: { pattern: CLEANUP_CRON }, jobId: 'files-cleanup-daily' })
    } catch (e) {
      // без Redis сервер всё равно жив; истёкшие материалы скрыты из списков и без чистки
      this.logger.warn(`Не удалось поставить ночную чистку файлов: ${e}`)
    }
  }
}
