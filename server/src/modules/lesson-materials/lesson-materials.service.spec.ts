import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { LessonMaterialsService } from './lesson-materials.service'
import { CreateLessonMaterialDto, LESSON_MATERIAL_TTL_DAYS } from './lesson-materials.dto'
import type { ClassAccessService } from '../class-access/class-access.service'
import type { FilesService } from '../files/files.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const DAY = 24 * 60 * 60 * 1000
const base = { email: 'x@s.tj', kindergartenId: 'k1', groupId: null, childId: null }
const teacher: AuthUser = { ...base, sub: 't1', role: 'TEACHER' }
const otherTeacher: AuthUser = { ...base, sub: 't2', role: 'TEACHER' }
const admin: AuthUser = { ...base, sub: 'a1', role: 'ADMIN' }
const student: AuthUser = { ...base, sub: 'u1', role: 'STUDENT', studentId: 'st1' }
const parent: AuthUser = { ...base, sub: 'p1', role: 'PARENT' }
const owner: AuthUser = { ...base, sub: 'o', role: 'SUPER_ADMIN', kindergartenId: null }

describe('LessonMaterialsService', () => {
  let prisma: PrismaMock
  let classAccess: { teacherGroupIds: jest.Mock; assertStaffAccess: jest.Mock }
  let files: { claim: jest.Mock; removeFile: jest.Mock; createLink: jest.Mock }
  let service: LessonMaterialsService

  beforeEach(() => {
    prisma = createPrismaMock()
    classAccess = {
      teacherGroupIds: jest.fn().mockResolvedValue(['g1']),
      assertStaffAccess: jest.fn().mockResolvedValue(undefined),
    }
    files = {
      claim: jest.fn().mockResolvedValue({ id: 'f1' }),
      removeFile: jest.fn().mockResolvedValue(undefined),
      createLink: jest.fn().mockResolvedValue({ id: 'f1', path: '/api/v1/files/dl/tok' }),
    }
    service = new LessonMaterialsService(
      prisma as unknown as PrismaService,
      classAccess as unknown as ClassAccessService,
      files as unknown as FilesService,
    )
    prisma.lessonMaterial.findMany.mockResolvedValue([])
  })

  describe('list', () => {
    const where = () => prisma.lessonMaterial.findMany.mock.calls[0][0].where

    it('ученик видит только материалы своего класса, истёкшие скрыты сразу', async () => {
      prisma.student.findUnique.mockResolvedValue({ groupId: 'g1' })
      await service.list(student, {})
      expect(where()).toMatchObject({ kindergartenId: 'k1', groupId: { in: ['g1'] } })
      expect(where().expiresAt.gt).toBeInstanceOf(Date)
    })

    it('родитель видит классы своих детей (без повторов)', async () => {
      prisma.student.findMany.mockResolvedValue([{ groupId: 'g1' }, { groupId: 'g1' }, { groupId: 'g2' }, { groupId: null }])
      await service.list(parent, {})
      expect(where().groupId).toEqual({ in: ['g1', 'g2'] })
    })

    it('учитель — свои классы; чужой класс по groupId — 403', async () => {
      await service.list(teacher, {})
      expect(where().groupId).toEqual({ in: ['g1'] })
      await expect(service.list(teacher, { groupId: 'g9' })).rejects.toThrow(ForbiddenException)
      prisma.lessonMaterial.findMany.mockClear()
      await service.list(teacher, { groupId: 'g1', subjectId: 's1' })
      expect(where()).toMatchObject({ groupId: 'g1', subjectId: 's1' })
    })

    it('админ школы видит все классы школы', async () => {
      await service.list(admin, {})
      expect(where()).not.toHaveProperty('groupId')
      expect(where().kindergartenId).toBe('k1')
    })

    it('ученик без класса и учитель без классов получают пустой список без запроса', async () => {
      prisma.student.findUnique.mockResolvedValue({ groupId: null })
      expect(await service.list(student, {})).toEqual([])
      classAccess.teacherGroupIds.mockResolvedValue([])
      expect(await service.list(teacher, {})).toEqual([])
      expect(prisma.lessonMaterial.findMany).not.toHaveBeenCalled()
    })

    it('владелец платформы без школы — 403', async () => {
      await expect(service.list(owner, {})).rejects.toThrow(ForbiddenException)
    })

    it('в ответе осталось дней до удаления и файл', async () => {
      prisma.student.findUnique.mockResolvedValue({ groupId: 'g1' })
      const now = Date.now()
      prisma.lessonMaterial.findMany.mockResolvedValue([
        { id: 'm1', title: 'A', description: null, url: null, createdAt: new Date(now), expiresAt: new Date(now + 30 * DAY - 1000), file: { id: 'f1', name: 'a.pdf', size: 5, mime: 'application/pdf' } },
        { id: 'm2', title: 'B', description: 't', url: null, createdAt: new Date(now), expiresAt: new Date(now + 1.5 * DAY), file: null },
      ])
      const res = await service.list(student, {})
      expect(res[0]).toMatchObject({ id: 'm1', daysLeft: 30, file: { id: 'f1', name: 'a.pdf' } })
      expect(res[1]).toMatchObject({ id: 'm2', daysLeft: 2, file: null })
    })
  })

  describe('create', () => {
    beforeEach(() => {
      prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'k1' })
      prisma.subject.findFirst.mockResolvedValue({ id: 's1' })
      prisma.lessonMaterial.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'm1',
        createdAt: new Date(),
        subject: null,
        group: { id: 'g1', name: '7А' },
        author: null,
        file: null,
        description: null,
        url: null,
        ...data,
      }))
    })

    it('срок жизни — 30 дней от создания; файл привязывается; автор — учитель', async () => {
      const before = Date.now()
      const res = await service.create(teacher, { groupId: 'g1', title: ' Тема 5 ', subjectId: 's1', fileId: 'f1' })
      const data = prisma.lessonMaterial.create.mock.calls[0][0].data
      expect(data).toMatchObject({ kindergartenId: 'k1', groupId: 'g1', subjectId: 's1', title: 'Тема 5', fileId: 'f1', authorId: 't1' })
      expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + LESSON_MATERIAL_TTL_DAYS * DAY)
      expect(data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + LESSON_MATERIAL_TTL_DAYS * DAY)
      expect(files.claim).toHaveBeenCalledWith(teacher, 'f1')
      expect(classAccess.assertStaffAccess).toHaveBeenCalledWith(teacher, { id: 'g1', kindergartenId: 'k1' })
      expect(res.daysLeft).toBe(30)
      expect(LESSON_MATERIAL_TTL_DAYS).toBe(30)
    })

    it('достаточно одного текста или одной ссылки, пустой материал — 400', async () => {
      await expect(service.create(teacher, { groupId: 'g1', title: 'Только текст', description: ' Прочитать §5 ' })).resolves.toBeDefined()
      expect(prisma.lessonMaterial.create.mock.calls[0][0].data).toMatchObject({ description: 'Прочитать §5', url: null, fileId: null })
      await expect(service.create(teacher, { groupId: 'g1', title: 'Только ссылка', url: 'https://youtu.be/x' })).resolves.toBeDefined()

      await expect(service.create(teacher, { groupId: 'g1', title: 'Пусто' })).rejects.toThrow(BadRequestException)
      await expect(service.create(teacher, { groupId: 'g1', title: 'Пусто', description: '   ', url: '' })).rejects.toThrow(/файл, ссылку или описание/)
    })

    it('чужой класс — отказ доступа проходит наружу, ничего не создаётся', async () => {
      classAccess.assertStaffAccess.mockRejectedValue(new ForbiddenException('Это не ваш класс'))
      await expect(service.create(otherTeacher, { groupId: 'g1', title: 'x', description: 'y' })).rejects.toThrow('Это не ваш класс')
      expect(files.claim).not.toHaveBeenCalled()
      expect(prisma.lessonMaterial.create).not.toHaveBeenCalled()
    })

    it('нет класса / предмет другой школы — 404; владелец платформы — 403', async () => {
      prisma.group.findUnique.mockResolvedValue(null)
      await expect(service.create(teacher, { groupId: 'nope', title: 'x', description: 'y' })).rejects.toThrow(NotFoundException)
      prisma.group.findUnique.mockResolvedValue({ id: 'g1', kindergartenId: 'k1' })
      prisma.subject.findFirst.mockResolvedValue(null)
      await expect(service.create(teacher, { groupId: 'g1', subjectId: 'foreign', title: 'x', description: 'y' })).rejects.toThrow(NotFoundException)
      await expect(service.create(owner, { groupId: 'g1', title: 'x', description: 'y' })).rejects.toThrow(ForbiddenException)
    })

    it('запись не создалась — файл отпускается для ночной чистки', async () => {
      prisma.lessonMaterial.create.mockRejectedValue(new Error('db down'))
      prisma.storedFile.update.mockResolvedValue({})
      await expect(service.create(teacher, { groupId: 'g1', title: 'x', fileId: 'f1' })).rejects.toThrow('db down')
      expect(prisma.storedFile.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { attached: false } })
    })
  })

  describe('remove', () => {
    const live = { id: 'm1', kindergartenId: 'k1', authorId: 't1', fileId: 'f1', groupId: 'g1', expiresAt: new Date(Date.now() + DAY) }

    it('автор и админ удаляют материал вместе с файлом; чужой учитель — нет', async () => {
      prisma.lessonMaterial.findUnique.mockResolvedValue(live)
      await expect(service.remove(otherTeacher, 'm1')).rejects.toThrow(ForbiddenException)
      expect(prisma.lessonMaterial.delete).not.toHaveBeenCalled()

      await service.remove(teacher, 'm1')
      await service.remove(admin, 'm1')
      expect(prisma.lessonMaterial.delete).toHaveBeenCalledTimes(2)
      expect(files.removeFile).toHaveBeenCalledWith('f1')
    })

    it('уже истёкший или несуществующий материал — 404', async () => {
      prisma.lessonMaterial.findUnique.mockResolvedValue({ ...live, expiresAt: new Date(Date.now() - 1000) })
      await expect(service.remove(teacher, 'm1')).rejects.toThrow(NotFoundException)
      prisma.lessonMaterial.findUnique.mockResolvedValue(null)
      await expect(service.remove(teacher, 'm1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('fileLink', () => {
    const live = { id: 'm1', kindergartenId: 'k1', authorId: 't1', fileId: 'f1', groupId: 'g1', expiresAt: new Date(Date.now() + DAY) }

    beforeEach(() => {
      prisma.lessonMaterial.findUnique.mockResolvedValue(live)
      prisma.storedFile.findUnique.mockResolvedValue({ id: 'f1', name: 'a.pdf', size: 1, mime: 'application/pdf' })
      prisma.student.findUnique.mockResolvedValue({ groupId: 'g1' })
    })

    it('ученик этого класса, учитель класса и админ получают ссылку', async () => {
      expect(await service.fileLink(student, 'm1')).toMatchObject({ path: '/api/v1/files/dl/tok' })
      await service.fileLink(teacher, 'm1')
      await service.fileLink(admin, 'm1')
      expect(files.createLink).toHaveBeenCalledTimes(3)
    })

    it('ученик другого класса, чужой учитель и другая школа — 403', async () => {
      prisma.student.findUnique.mockResolvedValue({ groupId: 'g2' })
      await expect(service.fileLink(student, 'm1')).rejects.toThrow(ForbiddenException)
      classAccess.teacherGroupIds.mockResolvedValue(['g9'])
      await expect(service.fileLink(otherTeacher, 'm1')).rejects.toThrow(ForbiddenException)
      prisma.lessonMaterial.findUnique.mockResolvedValue({ ...live, kindergartenId: 'k2' })
      await expect(service.fileLink(admin, 'm1')).rejects.toThrow(ForbiddenException)
      expect(files.createLink).not.toHaveBeenCalled()
    })

    it('материал без файла или истёкший — 404', async () => {
      prisma.lessonMaterial.findUnique.mockResolvedValue({ ...live, fileId: null })
      await expect(service.fileLink(student, 'm1')).rejects.toThrow(NotFoundException)
      prisma.lessonMaterial.findUnique.mockResolvedValue({ ...live, expiresAt: new Date(Date.now() - 1) })
      await expect(service.fileLink(student, 'm1')).rejects.toThrow(NotFoundException)
    })
  })
})

describe('CreateLessonMaterialDto', () => {
  const check = (extra: Record<string, unknown>) =>
    validate(plainToInstance(CreateLessonMaterialDto, { groupId: 'g1', title: 'T', ...extra }))

  it('ссылка необязательна, но если есть — только http(s)', async () => {
    expect(await check({})).toHaveLength(0)
    expect(await check({ url: '' })).toHaveLength(0)
    expect(await check({ url: 'https://youtu.be/abc' })).toHaveLength(0)
    expect((await check({ url: 'javascript:alert(1)' })).length).toBeGreaterThan(0)
    expect((await check({ url: 'ftp://x.org/a' })).length).toBeGreaterThan(0)
  })

  it('название обязательно и не длиннее 200 символов', async () => {
    expect((await check({ title: '' })).length).toBeGreaterThan(0)
    expect((await check({ title: 'x'.repeat(201) })).length).toBeGreaterThan(0)
  })
})
