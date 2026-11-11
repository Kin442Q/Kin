import { createReadStream } from 'node:fs'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { Readable } from 'node:stream'

import type { StorageDriver } from './storage.driver'

/**
 * Хранилище на локальном диске. Для разработки и для тома Railway
 * (`STORAGE_DIR` указывает на смонтированный том). Без тома файлы пропадают
 * при каждом деплое — поэтому в проде без STORAGE_DIR загрузка отключена
 * (см. FilesService.assertUploadsEnabled).
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string

  constructor(rootDir: string) {
    this.root = resolve(rootDir)
  }

  /** Путь внутри корня; ключ с `..` или абсолютный путь отвергаем. */
  private pathFor(key: string): string {
    const full = resolve(this.root, key)
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error('Недопустимый ключ хранилища')
    }
    return full
  }

  // meta нужен облачным драйверам (Content-Type, длина); на диске он не используется
  async putFromPath(key: string, filePath: string, _meta?: { mime: string; size: number }): Promise<void> {
    const target = this.pathFor(key)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(filePath, target)
  }

  async open(key: string): Promise<Readable> {
    return createReadStream(this.pathFor(key))
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.pathFor(prefix), { recursive: true, force: true })
  }
}
