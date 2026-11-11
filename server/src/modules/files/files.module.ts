import { join } from 'node:path'

import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import { QUEUE_FILES_CLEANUP } from '../../infrastructure/bullmq/bull.module'
import { FilesController } from './files.controller'
import { FilesCleanupProcessor, FilesCleanupScheduler } from './files-cleanup.job'
import { FilesService } from './files.service'
import { LocalStorageDriver } from './storage/local-storage.driver'
import { STORAGE_DRIVER } from './storage/storage.driver'

/**
 * Загруженные файлы: хранилище, проверка и выдача по короткой ссылке.
 * Материалы (библиотека, материалы к уроку) подключают FilesService.
 */
@Module({
  imports: [JwtModule.register({}), BullModule.registerQueue({ name: QUEUE_FILES_CLEANUP })],
  controllers: [FilesController],
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      // Другие драйверы (S3) подключаются здесь по STORAGE_DRIVER.
      useFactory: (config: ConfigService) =>
        new LocalStorageDriver(config.get<string>('storage.dir') ?? join(process.cwd(), 'storage')),
    },
    FilesService,
    FilesCleanupProcessor,
    FilesCleanupScheduler,
  ],
  exports: [FilesService],
})
export class FilesModule {}
