import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { StoredFile } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { open as openFile, unlink } from 'node:fs/promises'
import type { Readable } from 'node:stream'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { requireSchool } from '../../common/content-access'
import type { AuthUser } from '../../common/types/jwt-payload'
import { ALLOWED_EXTENSIONS, MB, describeFile, formatMb, matchesSignature } from './file-types'
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver'

/** Файл, который multer уже положил во временную папку. */
export interface UploadedTempFile {
  path: string
  originalname: string
  size: number
}

export interface StoredFileView {
  id: string
  name: string
  size: number
  mime: string
}

/** Сколько живёт ссылка на скачивание. */
export const DOWNLOAD_LINK_TTL = '5m'

/** Загрузка без привязки к материалу удаляется через это время. */
export const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000

export const toFileView = (f: Pick<StoredFile, 'id' | 'name' | 'size' | 'mime'>): StoredFileView => ({
  id: f.id,
  name: f.name,
  size: f.size,
  mime: f.mime,
})

/**
 * multer читает имя файла как latin1, из-за чего кириллица превращается в
 * «Ð¿...». Пробуем вернуть UTF-8; если не получилось — оставляем как есть.
 */
export function fixUploadedName(name: string): string {
  // Есть символы выше U+00FF — имя уже нормальный Юникод, перекодировать нельзя
  // (иначе «Учебник» превратится в мусор).
  if ([...name].some((c) => c.charCodeAt(0) > 0xff)) return name
  const decoded = Buffer.from(name, 'latin1').toString('utf8')
  return decoded.includes('�') ? name : decoded
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * В проде локальный диск Railway стирается при деплое: без смонтированного
   * тома (STORAGE_DIR) файлы бы пропадали, а записи оставались. Лучше
   * честно отказать.
   */
  uploadsEnabled(): boolean {
    return this.config.get<string>('env') !== 'production' || !!this.config.get<string>('storage.dir')
  }

  assertUploadsEnabled(): void {
    if (!this.uploadsEnabled()) {
      throw new ServiceUnavailableException('Загрузка файлов пока не настроена. Используйте ссылку.')
    }
  }

  quotaBytes(): number {
    return (this.config.get<number>('storage.quotaMb') ?? 2048) * MB
  }

  async usage(user: AuthUser) {
    const kindergartenId = requireSchool(user)
    const agg = await this.prisma.storedFile.aggregate({
      where: { kindergartenId },
      _sum: { size: true },
      _count: true,
    })
    return { usedBytes: agg._sum.size ?? 0, quotaBytes: this.quotaBytes(), files: agg._count }
  }

  /**
   * Принять загрузку: проверить тип, размер, подпись и квоту школы, положить
   * файл в хранилище и завести запись. Временный файл multer удаляется всегда.
   */
  async upload(user: AuthUser, file: UploadedTempFile | undefined): Promise<StoredFileView> {
    if (!file) throw new BadRequestException('Файл не получен (поле «file»)')
    try {
      const kindergartenId = requireSchool(user)
      this.assertUploadsEnabled()

      const name = fixUploadedName(file.originalname).slice(0, 200)
      const info = describeFile(name)
      if (!info) {
        throw new BadRequestException(`Этот тип файла не поддерживается. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`)
      }
      if (file.size <= 0) throw new BadRequestException('Файл пустой')
      if (file.size > info.maxBytes) {
        throw new PayloadTooLargeException(
          `Файл слишком большой: ${formatMb(file.size)}. Для этого типа максимум ${formatMb(info.maxBytes)}` +
            (info.kind === 'video' ? '' : '. Видео можно загрузить до 100 МБ или дать ссылку'),
        )
      }
      if (!matchesSignature(info.ext, await this.readHead(file.path))) {
        throw new BadRequestException('Содержимое файла не соответствует его типу')
      }

      const { usedBytes, quotaBytes } = await this.usage(user)
      if (usedBytes + file.size > quotaBytes) {
        throw new PayloadTooLargeException(
          `Не хватает места: занято ${formatMb(usedBytes)} из ${formatMb(quotaBytes)}. Удалите ненужные материалы`,
        )
      }

      const id = randomUUID()
      const key = `schools/${kindergartenId}/${id}`
      await this.storage.putFromPath(key, file.path, { mime: info.mime, size: file.size })
      try {
        const row = await this.prisma.storedFile.create({
          data: { id, kindergartenId, key, name, mime: info.mime, size: file.size, uploaderId: user.sub },
        })
        return toFileView(row)
      } catch (e) {
        await this.storage.delete(key).catch(() => undefined)
        throw e
      }
    } finally {
      await unlink(file.path).catch(() => undefined)
    }
  }

  private async readHead(path: string): Promise<Buffer> {
    const fh = await openFile(path, 'r')
    try {
      const buf = Buffer.alloc(16)
      const { bytesRead } = await fh.read(buf, 0, 16, 0)
      return buf.subarray(0, bytesRead)
    } finally {
      await fh.close()
    }
  }

  /**
   * Привязать загруженный файл к материалу: файл должен быть из той же школы,
   * загружен этим же пользователем (админ школы может привязать чужой) и ещё
   * не привязан.
   */
  async claim(user: AuthUser, fileId: string): Promise<StoredFile> {
    const kindergartenId = requireSchool(user)
    const f = await this.prisma.storedFile.findFirst({ where: { id: fileId, kindergartenId } })
    if (!f) throw new NotFoundException('Файл не найден — загрузите его заново')
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
    if (!isAdmin && f.uploaderId !== user.sub) throw new BadRequestException('Это не ваш файл')
    if (f.attached) throw new BadRequestException('Файл уже используется в другом материале')
    return this.prisma.storedFile.update({ where: { id: f.id }, data: { attached: true } })
  }

  /** Удалить файл целиком: из хранилища и из базы. Повторный вызов безопасен. */
  async removeFile(fileId: string | null | undefined): Promise<void> {
    if (!fileId) return
    const f = await this.prisma.storedFile.findUnique({ where: { id: fileId } })
    if (!f) return
    await this.storage.delete(f.key).catch((e) => this.logger.warn(`Не удалось удалить ${f.key}: ${e}`))
    await this.prisma.storedFile.deleteMany({ where: { id: f.id } })
  }

  /** Удалить все файлы школы из хранилища (вызывается при удалении школы). */
  async removeSchoolFiles(kindergartenId: string): Promise<void> {
    await this.storage
      .deletePrefix(`schools/${kindergartenId}`)
      .catch((e) => this.logger.warn(`Не удалось очистить файлы школы ${kindergartenId}: ${e}`))
  }

  // ─── Скачивание по короткой ссылке ───────────────────────────────

  private linkSecret(): string {
    // отдельный секрет: токен доступа к файлу нельзя использовать как access-token и наоборот
    return `${this.config.get<string>('jwt.accessSecret')}:file`
  }

  /** Выдать короткоживущую ссылку. Права на файл проверяет вызывающий сервис. */
  async createLink(file: Pick<StoredFile, 'id' | 'name' | 'size' | 'mime'>) {
    const token = await this.jwt.signAsync(
      { typ: 'file', fid: file.id },
      { secret: this.linkSecret(), expiresIn: DOWNLOAD_LINK_TTL },
    )
    return { ...toFileView(file), path: `/api/v1/files/dl/${token}` }
  }

  async openByToken(token: string): Promise<{ file: StoredFile; stream: Readable }> {
    let payload: { typ?: string; fid?: string }
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.linkSecret() })
    } catch {
      throw new UnauthorizedException('Ссылка устарела. Откройте файл заново')
    }
    if (payload.typ !== 'file' || !payload.fid) throw new UnauthorizedException('Неверная ссылка')
    const file = await this.prisma.storedFile.findUnique({ where: { id: payload.fid } })
    if (!file) throw new NotFoundException('Файл удалён')
    try {
      return { file, stream: await this.storage.open(file.key) }
    } catch {
      throw new HttpException('Файл недоступен', 410)
    }
  }

  // ─── Ночная чистка ────────────────────────────────────────────────

  /**
   * Удаляет то, что истекло: материалы к уроку старше 30 дней вместе с их
   * файлами и загрузки, которые так и не привязали к материалу (через сутки).
   * Идемпотентна: можно запускать сколько угодно раз и параллельно.
   */
  async cleanup(now = new Date()): Promise<{ materials: number; files: number }> {
    const expired = await this.prisma.lessonMaterial.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, fileId: true },
    })
    if (expired.length) {
      await this.prisma.lessonMaterial.deleteMany({ where: { id: { in: expired.map((m) => m.id) } } })
    }
    let files = 0
    for (const m of expired) {
      if (m.fileId) {
        await this.removeFile(m.fileId)
        files++
      }
    }

    const orphans = await this.prisma.storedFile.findMany({
      where: { attached: false, createdAt: { lte: new Date(now.getTime() - ORPHAN_TTL_MS) } },
      select: { id: true },
    })
    for (const o of orphans) {
      await this.removeFile(o.id)
      files++
    }

    if (expired.length || files) {
      this.logger.log(`Чистка: материалов ${expired.length}, файлов ${files}`)
    }
    return { materials: expired.length, files }
  }
}
