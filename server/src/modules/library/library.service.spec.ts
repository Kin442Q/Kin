import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { LibraryService } from './library.service'
import type { FilesService } from '../files/files.service'
import { CreateLibraryItemDto } from './library.dto'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const base = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }
const other: AuthUser = { ...base, sub: 't2', role: 'TEACHER' }
const admin: AuthUser = { ...base, sub: 'a', role: 'ADMIN' }
const student: AuthUser = { ...base, sub: 'u', role: 'STUDENT', studentId: 'st1' }
const owner: AuthUser = { ...base, sub: 'o', role: 'SUPER_ADMIN', kindergartenId: null }

describe('LibraryService', () => {
  let prisma: PrismaMock
  let files: { claim: jest.Mock; removeFile: jest.Mock; createLink: jest.Mock }
  let service: LibraryService

  beforeEach(() => {
    prisma = createPrismaMock()
    files = {
      claim: jest.fn().mockResolvedValue({ id: 'f1' }),
      removeFile: jest.fn().mockResolvedValue(undefined),
      createLink: jest.fn().mockResolvedValue({ id: 'f1', path: '/api/v1/files/dl/tok' }),
    }
    service = new LibraryService(prisma as unknown as PrismaService, files as unknown as FilesService)
  })

  describe('list', () => {
    beforeEach(() => prisma.libraryItem.findMany.mockResolvedValue([]))

    it('только материалы своей школы', async () => {
      await service.list(student, {})
      expect(prisma.libraryItem.findMany.mock.calls[0][0].where).toEqual({ kindergartenId: 'k1' })
    })

    it('фильтры: тип, предмет, параллель (материалы «для всех» видны всегда), поиск', async () => {
      await service.list(student, { type: 'VIDEO', subjectId: 's1', gradeNumber: 5, q: '  дроби ' })
      const where = prisma.libraryItem.findMany.mock.calls[0][0].where
      expect(where).toMatchObject({ kindergartenId: 'k1', type: 'VIDEO', subjectId: 's1' })
      expect(where.OR).toEqual([{ gradeNumber: null }, { gradeNumber: 5 }])
      expect(JSON.stringify(where.AND)).toContain('дроби')
      expect(JSON.stringify(where.AND)).toContain('insensitive')
    })

    it('родителю библиотека недоступна', async () => {
      await expect(service.list({ ...base, sub: 'p', role: 'PARENT' }, {})).rejects.toThrow(ForbiddenException)
    })
  })

  describe('create', () => {
    beforeEach(() => {
      prisma.libraryItem.create.mockResolvedValue({ id: 'i1' })
      prisma.subject.findFirst.mockResolvedValue({ id: 's1' })
    })

    it('создаёт материал в школе автора', async () => {
      await service.create(teacher, { title: ' Дроби ', type: 'ARTICLE', url: ' https://example.org/a ', subjectId: 's1' })
      expect(prisma.libraryItem.create.mock.calls[0][0].data).toMatchObject({
        kindergartenId: 'k1',
        title: 'Дроби',
        type: 'ARTICLE',
        url: 'https://example.org/a',
        subjectId: 's1',
        gradeNumber: null,
        authorId: 't1',
      })
    })

    it('предмет другой школы — 404; владелец платформы создавать не может', async () => {
      prisma.subject.findFirst.mockResolvedValue(null)
      await expect(
        service.create(teacher, { title: 'x', type: 'LINK', url: 'https://a.b', subjectId: 'foreign' }),
      ).rejects.toThrow(NotFoundException)
      await expect(service.create(owner, { title: 'x', type: 'LINK', url: 'https://a.b' })).rejects.toThrow(
        ForbiddenException,
      )
      expect(prisma.libraryItem.create).not.toHaveBeenCalled()
    })
  })

  describe('create — файл вместо ссылки', () => {
    beforeEach(() => prisma.libraryItem.create.mockResolvedValue({ id: 'i1' }))

    it('с fileId: файл привязывается, ссылка пустая', async () => {
      await service.create(teacher, { title: 'Учебник', type: 'BOOK', fileId: 'f1' })
      expect(files.claim).toHaveBeenCalledWith(teacher, 'f1')
      expect(prisma.libraryItem.create.mock.calls[0][0].data).toMatchObject({ url: null, fileId: 'f1' })
    })

    it('ни ссылки, ни файла — 400, файл не трогаем', async () => {
      await expect(service.create(teacher, { title: 'Пусто', type: 'BOOK' })).rejects.toThrow(BadRequestException)
      await expect(service.create(teacher, { title: 'Пусто', type: 'BOOK', url: '  ' })).rejects.toThrow(BadRequestException)
      expect(files.claim).not.toHaveBeenCalled()
      expect(prisma.libraryItem.create).not.toHaveBeenCalled()
    })

    it('запись не создалась — файл отпускается, чтобы его убрала чистка', async () => {
      prisma.libraryItem.create.mockRejectedValue(new Error('db down'))
      prisma.storedFile.update.mockResolvedValue({})
      await expect(service.create(teacher, { title: 'x', type: 'BOOK', fileId: 'f1' })).rejects.toThrow('db down')
      expect(prisma.storedFile.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { attached: false } })
    })
  })

  describe('update / remove', () => {
    beforeEach(() => {
      prisma.libraryItem.findUnique.mockResolvedValue({ id: 'i1', kindergartenId: 'k1', authorId: 't1' })
      prisma.libraryItem.update.mockResolvedValue({})
    })

    it('автор и админ школы правят и удаляют; чужой учитель — нет', async () => {
      await service.update(teacher, 'i1', { title: 'Новое' })
      expect(prisma.libraryItem.update.mock.calls[0][0].data).toEqual({ title: 'Новое' })
      await service.update(admin, 'i1', { gradeNumber: null })
      expect(prisma.libraryItem.update.mock.calls[1][0].data).toEqual({ gradeNumber: null })

      await expect(service.update(other, 'i1', { title: 'x' })).rejects.toThrow(ForbiddenException)
      await expect(service.remove(other, 'i1')).rejects.toThrow(ForbiddenException)
      await service.remove(admin, 'i1')
      expect(prisma.libraryItem.delete).toHaveBeenCalledTimes(1)
    })

    it('несуществующий материал — 404', async () => {
      prisma.libraryItem.findUnique.mockResolvedValue(null)
      await expect(service.remove(admin, 'nope')).rejects.toThrow(NotFoundException)
    })

    it('удаление материала удаляет и его файл', async () => {
      prisma.libraryItem.findUnique.mockResolvedValue({ id: 'i1', kindergartenId: 'k1', authorId: 't1', fileId: 'f9' })
      await service.remove(teacher, 'i1')
      expect(files.removeFile).toHaveBeenCalledWith('f9')
    })

    it('замена файла: новый привязан, старый удалён', async () => {
      prisma.libraryItem.findUnique.mockResolvedValue({ id: 'i1', kindergartenId: 'k1', authorId: 't1', fileId: 'old', url: null })
      await service.update(teacher, 'i1', { fileId: 'f1' })
      expect(prisma.libraryItem.update.mock.calls[0][0].data).toEqual({ fileId: 'f1' })
      expect(files.removeFile).toHaveBeenCalledWith('old')
    })

    it('нельзя остаться и без ссылки, и без файла', async () => {
      prisma.libraryItem.findUnique.mockResolvedValue({ id: 'i1', kindergartenId: 'k1', authorId: 't1', fileId: 'f1', url: null })
      await expect(service.update(teacher, 'i1', { fileId: null })).rejects.toThrow(BadRequestException)
      expect(prisma.libraryItem.update).not.toHaveBeenCalled()
      expect(files.removeFile).not.toHaveBeenCalled()
    })
  })

  describe('fileLink', () => {
    it('ученик своей школы получает ссылку', async () => {
      prisma.libraryItem.findUnique.mockResolvedValue({ id: 'i1', kindergartenId: 'k1', fileId: 'f1' })
      prisma.storedFile.findUnique.mockResolvedValue({ id: 'f1', name: 'a.pdf', size: 10, mime: 'application/pdf' })
      expect(await service.fileLink(student, 'i1')).toMatchObject({ path: '/api/v1/files/dl/tok' })
    })

    it('материал другой школы — 403, материал без файла — 404, родитель — 403', async () => {
      prisma.libraryItem.findUnique.mockResolvedValue({ id: 'i1', kindergartenId: 'k2', fileId: 'f1' })
      await expect(service.fileLink(student, 'i1')).rejects.toThrow(ForbiddenException)
      prisma.libraryItem.findUnique.mockResolvedValue({ id: 'i1', kindergartenId: 'k1', fileId: null })
      await expect(service.fileLink(student, 'i1')).rejects.toThrow(NotFoundException)
      await expect(service.fileLink({ ...base, sub: 'p', role: 'PARENT' }, 'i1')).rejects.toThrow(ForbiddenException)
    })
  })
})

describe('CreateLibraryItemDto — ссылка', () => {
  const check = (url: string) =>
    validate(plainToInstance(CreateLibraryItemDto, { title: 'T', type: 'LINK', url }))

  it('принимает http(s), в том числе внутришкольные адреса без домена', async () => {
    expect(await check('https://example.org/book.pdf')).toHaveLength(0)
    expect(await check('http://library.local/doc')).toHaveLength(0)
    expect(await check('http://localhost:8080/a')).toHaveLength(0)
  })

  it('отклоняет опасные и неполные ссылки', async () => {
    for (const bad of ['javascript:alert(1)', 'ftp://x.org/a', 'example.org', 'data:text/html,<b>x</b>']) {
      expect((await check(bad)).length).toBeGreaterThan(0)
    }
  })
})
