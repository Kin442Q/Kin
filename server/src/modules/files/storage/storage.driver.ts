import type { Readable } from 'node:stream'

/**
 * Хранилище файлов. База хранит только записи (StoredFile), сами файлы лежат
 * здесь: на локальном диске (разработка / том Railway) или в S3-совместимом
 * облаке. Ключи формирует сервис (`schools/<школа>/<id>`), драйвер им доверяет,
 * но от выхода за пределы корня всё равно защищается.
 */
export interface StorageDriver {
  /** Положить файл (путь к временному файлу на диске) под ключом. */
  putFromPath(key: string, filePath: string, meta: { mime: string; size: number }): Promise<void>
  /** Открыть файл для чтения. Бросает ошибку, если файла нет. */
  open(key: string): Promise<Readable>
  /** Удалить файл. Отсутствие файла — не ошибка (чистка идемпотентна). */
  delete(key: string): Promise<void>
  /** Удалить всё под префиксом (при удалении школы). */
  deletePrefix(prefix: string): Promise<void>
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER')
