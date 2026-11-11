import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'

import { MAX_UPLOAD_BYTES } from './file-types'

const TMP_DIR = join(tmpdir(), 'kin-uploads')

/**
 * Приём одного файла в поле «file»: сначала во временную папку на диске (не в
 * память — видео до 100 МБ), потом FilesService.upload проверяет и переносит в
 * хранилище. Верхний предел multer — самый большой из лимитов по видам файлов,
 * точные лимиты проверяет сервис.
 */
export const singleFileUpload = () =>
  FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        mkdirSync(TMP_DIR, { recursive: true })
        cb(null, TMP_DIR)
      },
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  })
