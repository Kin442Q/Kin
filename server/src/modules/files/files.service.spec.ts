import { mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { FilesService, ORPHAN_TTL_MS, fixUploadedName, type UploadedTempFile } from './files.service'
import { MB } from './file-types'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }
const admin: AuthUser = { ...base, sub: 'a1', role: 'ADMIN' }
const owner: AuthUser = { ...base, sub: 'o', role: 'SUPER_ADMIN', kindergartenId: null }

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32, 0x20)])

describe('FilesService', () => {
  let prisma: PrismaMock
  let storage: { putFromPath: jest.Mock; open: jest.Mock; delete: jest.Mock; deletePrefix: jest.Mock }
  let cfg: Record<string, unknown>
  let service: FilesService
  let dir: string

  /** Временный файл, как его оставляет multer. */
  const tmpFile = async (content: Buffer, originalname: string, size = content.length): Promise<UploadedTempFile> => {
    const path = join(dir, `${Math.random().toString(36).slice(2)}.tmp`)
    await writeFile(path, content)
    return { path, originalname, size }
  }
  const exists = (p: string) => stat(p).then(() => true, () => false)

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kin-files-spec-'))
    prisma = createPrismaMock()
    storage = {
      putFromPath: jest.fn().mockResolvedValue(undefined),
      open: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      deletePrefix: jest.fn().mockResolvedValue(undefined),
    }
    cfg = { env: 'development', 'storage.quotaMb': 2048, 'jwt.accessSecret': 'access-secret-for-tests-1234' }
    const config = { get: (k: string) => cfg[k] }
    service = new FilesService(prisma as unknown as PrismaService, storage, config as never, new JwtService({}))
    prisma.storedFile.aggregate.mockResolvedValue({ _sum: { size: 0 }, _count: 0 })
    prisma.storedFile.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }))
  })

  describe('upload', () => {
    it('успех: файл в хранилище по ключу школы, запись в базе, MIME — наш, временный файл удалён', async () => {
      const f = await tmpFile(PDF, 'Учебник.pdf')
      const view = await service.upload(teacher, f)

      expect(storage.putFromPath).toHaveBeenCalledTimes(1)
      const [key, path, meta] = storage.putFromPath.mock.calls[0]
      expect(key).toMatch(/^schools\/k1\/[0-9a-f-]{36}$/)
      expect(path).toBe(f.path)
      expect(meta).toEqual({ mime: 'application/pdf', size: PDF.length })
      expect(prisma.storedFile.create.mock.calls[0][0].data).toMatchObject({
        kindergartenId: 'k1',
        key,
        name: 'Учебник.pdf',
        mime: 'application/pdf',
        uploaderId: 't1',
      })
      expect(view).toMatchObject({ name: 'Учебник.pdf', size: PDF.length, mime: 'application/pdf' })
      expect(await exists(f.path)).toBe(false)
    })

    it('имя в кодировке latin1 (так отдаёт multer) восстанавливается в кириллицу', async () => {
      const mangled = Buffer.from('Урок 5.pdf', 'utf8').toString('latin1')
      const view = await service.upload(teacher, await tmpFile(PDF, mangled))
      expect(view.name).toBe('Урок 5.pdf')
      expect(fixUploadedName('plain.pdf')).toBe('plain.pdf')
      // уже правильное имя и имя с латинскими диакритиками не портим
      expect(fixUploadedName('Учебник.pdf')).toBe('Учебник.pdf')
      expect(fixUploadedName('café.pdf')).toBe('café.pdf')
    })

    it('нет файла — 400; владелец платформы (без школы) — 403', async () => {
      await expect(service.upload(teacher, undefined)).rejects.toThrow(BadRequestException)
      const f = await tmpFile(PDF, 'a.pdf')
      await expect(service.upload(owner, f)).rejects.toThrow(ForbiddenException)
      expect(await exists(f.path)).toBe(false) // временный файл убран и при отказе
    })

    it('в production без STORAGE_DIR загрузка отключена (иначе файлы пропадут при деплое)', async () => {
      cfg.env = 'production'
      expect(service.uploadsEnabled()).toBe(false)
      const f = await tmpFile(PDF, 'a.pdf')
      await expect(service.upload(teacher, f)).rejects.toThrow(ServiceUnavailableException)
      expect(storage.putFromPath).not.toHaveBeenCalled()
      expect(await exists(f.path)).toBe(false)

      cfg['storage.dir'] = '/data/files' // подключён том
      expect(service.uploadsEnabled()).toBe(true)
    })

    it('неподдерживаемый тип и пустой файл — 400', async () => {
      await expect(service.upload(teacher, await tmpFile(Buffer.from('MZ'), 'virus.exe'))).rejects.toThrow(/не поддерживается/)
      await expect(service.upload(teacher, await tmpFile(Buffer.alloc(0), 'empty.pdf'))).rejects.toThrow(/пустой/)
      expect(storage.putFromPath).not.toHaveBeenCalled()
    })

    it('лимит по виду: документ >20 МБ — 413, видео 50 МБ проходит, видео >100 МБ — 413', async () => {
      await expect(service.upload(teacher, await tmpFile(PDF, 'big.pdf', 21 * MB))).rejects.toThrow(PayloadTooLargeException)
      await expect(service.upload(teacher, await tmpFile(PDF, 'big.pdf', 21 * MB))).rejects.toThrow(/максимум 20 МБ/)

      const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(16)])
      await expect(service.upload(teacher, await tmpFile(mp4, 'ok.mp4', 50 * MB))).resolves.toMatchObject({ mime: 'video/mp4' })
      await expect(service.upload(teacher, await tmpFile(mp4, 'huge.mp4', 101 * MB))).rejects.toThrow(PayloadTooLargeException)
    })

    it('подпись не совпадает с расширением (программа под видом pdf) — 400', async () => {
      const f = await tmpFile(Buffer.from('MZ\x90\x00\x03 not a pdf at all'), 'doc.pdf')
      await expect(service.upload(teacher, f)).rejects.toThrow(/не соответствует/)
      expect(storage.putFromPath).not.toHaveBeenCalled()
      expect(await exists(f.path)).toBe(false)
    })

    it('квота школы: превышение — 413 и файл не сохраняется', async () => {
      cfg['storage.quotaMb'] = 1
      prisma.storedFile.aggregate.mockResolvedValue({ _sum: { size: 1 * MB - 10 }, _count: 3 })
      await expect(service.upload(teacher, await tmpFile(PDF, 'a.pdf'))).rejects.toThrow(/Не хватает места/)
      expect(storage.putFromPath).not.toHaveBeenCalled()
      expect(prisma.storedFile.create).not.toHaveBeenCalled()
    })

    it('не удалось положить в хранилище — записи в базе нет, временный файл убран', async () => {
      storage.putFromPath.mockRejectedValue(new Error('disk full'))
      const f = await tmpFile(PDF, 'a.pdf')
      await expect(service.upload(teacher, f)).rejects.toThrow('disk full')
      expect(prisma.storedFile.create).not.toHaveBeenCalled()
      expect(await exists(f.path)).toBe(false)
    })

    it('не удалось создать запись — файл убирается из хранилища (не копим мусор)', async () => {
      prisma.storedFile.create.mockRejectedValue(new Error('db down'))
      await expect(service.upload(teacher, await tmpFile(PDF, 'a.pdf'))).rejects.toThrow('db down')
      expect(storage.delete).toHaveBeenCalledWith(storage.putFromPath.mock.calls[0][0])
    })
  })

  describe('usage', () => {
    it('занято / лимит / число файлов своей школы', async () => {
      prisma.storedFile.aggregate.mockResolvedValue({ _sum: { size: 5 * MB }, _count: 2 })
      expect(await service.usage(teacher)).toEqual({ usedBytes: 5 * MB, quotaBytes: 2048 * MB, files: 2 })
      expect(prisma.storedFile.aggregate.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1' })
      await expect(service.usage(owner)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('claim', () => {
    const row = { id: 'f1', kindergartenId: 'k1', uploaderId: 't1', attached: false }

    it('свой свободный файл привязывается', async () => {
      prisma.storedFile.findFirst.mockResolvedValue(row)
      prisma.storedFile.update.mockResolvedValue({ ...row, attached: true })
      expect((await service.claim(teacher, 'f1')).attached).toBe(true)
      expect(prisma.storedFile.findFirst.mock.calls[0][0].where).toEqual({ id: 'f1', kindergartenId: 'k1' })
    })

    it('чужой файл учителю нельзя, админу школы можно; уже привязанный и чужой школы — нельзя', async () => {
      prisma.storedFile.findFirst.mockResolvedValue({ ...row, uploaderId: 'someone-else' })
      await expect(service.claim(teacher, 'f1')).rejects.toThrow(BadRequestException)
      prisma.storedFile.update.mockResolvedValue({})
      await expect(service.claim(admin, 'f1')).resolves.toBeDefined()

      prisma.storedFile.findFirst.mockResolvedValue({ ...row, attached: true })
      await expect(service.claim(teacher, 'f1')).rejects.toThrow(/уже используется/)

      prisma.storedFile.findFirst.mockResolvedValue(null)
      await expect(service.claim(teacher, 'f1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('removeFile / removeSchoolFiles', () => {
    it('удаляет из хранилища и из базы; повтор и пустой id безопасны', async () => {
      prisma.storedFile.findUnique.mockResolvedValueOnce({ id: 'f1', key: 'schools/k1/f1' })
      await service.removeFile('f1')
      expect(storage.delete).toHaveBeenCalledWith('schools/k1/f1')
      expect(prisma.storedFile.deleteMany).toHaveBeenCalledWith({ where: { id: 'f1' } })

      prisma.storedFile.findUnique.mockResolvedValueOnce(null)
      await service.removeFile('f1')
      await service.removeFile(null)
      expect(storage.delete).toHaveBeenCalledTimes(1)
    })

    it('сбой хранилища не мешает убрать запись; файлы школы удаляются по префиксу', async () => {
      prisma.storedFile.findUnique.mockResolvedValue({ id: 'f1', key: 'schools/k1/f1' })
      storage.delete.mockRejectedValue(new Error('s3 down'))
      await service.removeFile('f1')
      expect(prisma.storedFile.deleteMany).toHaveBeenCalled()

      await service.removeSchoolFiles('k1')
      expect(storage.deletePrefix).toHaveBeenCalledWith('schools/k1')
    })
  })

  describe('ссылки на скачивание', () => {
    const file = { id: 'f1', name: 'a.pdf', size: 10, mime: 'application/pdf', key: 'schools/k1/f1' }
    const tokenOf = (path: string) => path.split('/').pop()!

    it('ссылка открывается и отдаёт поток файла', async () => {
      const link = await service.createLink(file)
      expect(link.path).toMatch(/^\/api\/v1\/files\/dl\/.+/)
      expect(link).toMatchObject({ id: 'f1', name: 'a.pdf', size: 10, mime: 'application/pdf' })

      prisma.storedFile.findUnique.mockResolvedValue(file)
      storage.open.mockResolvedValue('STREAM')
      const opened = await service.openByToken(tokenOf(link.path))
      expect(opened.file.id).toBe('f1')
      expect(opened.stream).toBe('STREAM')
      expect(storage.open).toHaveBeenCalledWith('schools/k1/f1')
    })

    it('токен доступа (access-token) как ссылка на файл не подходит, и наоборот', async () => {
      const jwt = new JwtService({})
      const accessLike = await jwt.signAsync({ typ: 'file', fid: 'f1' }, { secret: 'access-secret-for-tests-1234', expiresIn: '5m' })
      await expect(service.openByToken(accessLike)).rejects.toThrow(UnauthorizedException)

      const wrongType = await jwt.signAsync({ typ: 'access', fid: 'f1' }, { secret: 'access-secret-for-tests-1234:file', expiresIn: '5m' })
      await expect(service.openByToken(wrongType)).rejects.toThrow(/Неверная ссылка/)
      await expect(service.openByToken('garbage')).rejects.toThrow(UnauthorizedException)
    })

    it('просроченная ссылка — 401', async () => {
      const jwt = new JwtService({})
      const expired = await jwt.signAsync({ typ: 'file', fid: 'f1' }, { secret: 'access-secret-for-tests-1234:file', expiresIn: '-10s' })
      await expect(service.openByToken(expired)).rejects.toThrow(/устарела/)
    })

    it('файл удалён из базы — 404; из хранилища пропал — 410', async () => {
      const token = tokenOf((await service.createLink(file)).path)
      prisma.storedFile.findUnique.mockResolvedValue(null)
      await expect(service.openByToken(token)).rejects.toThrow(NotFoundException)

      prisma.storedFile.findUnique.mockResolvedValue(file)
      storage.open.mockRejectedValue(new Error('ENOENT'))
      await expect(service.openByToken(token)).rejects.toMatchObject({ status: 410 })
    })
  })

  describe('cleanup', () => {
    const now = new Date('2026-12-10T03:00:00Z')

    it('удаляет истёкшие материалы вместе с файлами и забытые загрузки старше суток', async () => {
      prisma.lessonMaterial.findMany.mockResolvedValue([
        { id: 'm1', fileId: 'f1' },
        { id: 'm2', fileId: null },
      ])
      prisma.storedFile.findMany.mockResolvedValue([{ id: 'orphan' }])
      prisma.storedFile.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, key: `schools/k1/${where.id}` }))

      const res = await service.cleanup(now)

      expect(res).toEqual({ materials: 2, files: 2 })
      expect(prisma.lessonMaterial.findMany.mock.calls[0][0].where).toEqual({ expiresAt: { lte: now } })
      expect(prisma.lessonMaterial.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['m1', 'm2'] } } })
      expect(storage.delete.mock.calls.map((c) => c[0]).sort()).toEqual(['schools/k1/f1', 'schools/k1/orphan'])
      const orphanWhere = prisma.storedFile.findMany.mock.calls[0][0].where
      expect(orphanWhere.attached).toBe(false)
      expect(orphanWhere.createdAt.lte).toEqual(new Date(now.getTime() - ORPHAN_TTL_MS))
    })

    it('нечего чистить — нули и ни одного удаления; повторный запуск безопасен', async () => {
      prisma.lessonMaterial.findMany.mockResolvedValue([])
      prisma.storedFile.findMany.mockResolvedValue([])
      expect(await service.cleanup(now)).toEqual({ materials: 0, files: 0 })
      expect(prisma.lessonMaterial.deleteMany).not.toHaveBeenCalled()
      expect(storage.delete).not.toHaveBeenCalled()
    })
  })
})
