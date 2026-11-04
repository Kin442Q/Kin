import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { LibraryService } from './library.service'
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
  let service: LibraryService

  beforeEach(() => {
    prisma = createPrismaMock()
    service = new LibraryService(prisma as unknown as PrismaService)
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
    for (const bad of ['javascript:alert(1)', 'ftp://x.org/a', 'example.org', 'data:text/html,<b>x</b>', '']) {
      expect((await check(bad)).length).toBeGreaterThan(0)
    }
  })
})
