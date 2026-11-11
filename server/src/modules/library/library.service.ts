import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { assertCanManage, assertSameSchool, requireSchool } from '../../common/content-access'
import type { AuthUser } from '../../common/types/jwt-payload'
import { FilesService } from '../files/files.service'
import type { CreateLibraryItemDto, LibraryType, UpdateLibraryItemDto } from './library.dto'

const READERS = ['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']

const INCLUDE = {
  subject: { select: { id: true, name: true, color: true } },
  author: { select: { id: true, fullName: true } },
  file: { select: { id: true, name: true, size: true, mime: true } },
} satisfies Prisma.LibraryItemInclude

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  private async assertSubject(kindergartenId: string, subjectId?: string | null) {
    if (!subjectId) return
    const s = await this.prisma.subject.findFirst({ where: { id: subjectId, kindergartenId }, select: { id: true } })
    if (!s) throw new NotFoundException('Предмет не найден')
  }

  async list(
    user: AuthUser,
    params: { type?: LibraryType; subjectId?: string; gradeNumber?: number; q?: string },
  ) {
    if (!READERS.includes(user.role)) throw new ForbiddenException('Нет доступа')
    const q = params.q?.trim()
    const where: Prisma.LibraryItemWhereInput = {
      ...(user.kindergartenId ? { kindergartenId: user.kindergartenId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
      // материал «для всех классов» (null) виден всегда, остальные — по параллели
      ...(params.gradeNumber ? { OR: [{ gradeNumber: null }, { gradeNumber: params.gradeNumber }] } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' as const } },
                  { description: { contains: q, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {}),
    }
    return this.prisma.libraryItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: INCLUDE,
    })
  }

  async create(user: AuthUser, dto: CreateLibraryItemDto) {
    const kindergartenId = requireSchool(user)
    await this.assertSubject(kindergartenId, dto.subjectId)

    const url = dto.url?.trim() || null
    if (!url && !dto.fileId) throw new BadRequestException('Укажите ссылку или загрузите файл')

    const file = dto.fileId ? await this.files.claim(user, dto.fileId) : null
    try {
      return await this.prisma.libraryItem.create({
        data: {
          kindergartenId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          type: dto.type,
          url,
          fileId: file?.id ?? null,
          subjectId: dto.subjectId || null,
          gradeNumber: dto.gradeNumber ?? null,
          authorId: user.sub,
        },
        include: INCLUDE,
      })
    } catch (e) {
      // запись не создалась — отпустить файл, чтобы его убрала ночная чистка
      if (file) await this.prisma.storedFile.update({ where: { id: file.id }, data: { attached: false } }).catch(() => undefined)
      throw e
    }
  }

  private async load(id: string) {
    const item = await this.prisma.libraryItem.findUnique({ where: { id } })
    if (!item) throw new NotFoundException('Материал не найден')
    return item
  }

  async update(user: AuthUser, id: string, dto: UpdateLibraryItemDto) {
    const item = await this.load(id)
    assertCanManage(user, item)
    await this.assertSubject(item.kindergartenId, dto.subjectId)

    const data: Prisma.LibraryItemUncheckedUpdateInput = {}
    if (dto.title !== undefined) data.title = dto.title.trim()
    if (dto.description !== undefined) data.description = dto.description?.trim() || null
    if (dto.type !== undefined) data.type = dto.type
    if (dto.url !== undefined) data.url = dto.url?.trim() || null
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId || null
    if (dto.gradeNumber !== undefined) data.gradeNumber = dto.gradeNumber ?? null

    let newFileId: string | null | undefined
    if (dto.fileId !== undefined) {
      newFileId = dto.fileId ? (await this.files.claim(user, dto.fileId)).id : null
      data.fileId = newFileId
    }

    // Проверяем только когда правка трогает ссылку или файл: правка названия
    // не должна упираться в состояние, которого она не меняет.
    if ('url' in data || 'fileId' in data) {
      const nextUrl = 'url' in data ? data.url : item.url
      const nextFile = 'fileId' in data ? data.fileId : item.fileId
      if (!nextUrl && !nextFile) throw new BadRequestException('Нужна ссылка или файл')
    }

    const updated = await this.prisma.libraryItem.update({ where: { id }, data, include: INCLUDE })
    // файл заменили или убрали — старый удаляем из хранилища
    if (newFileId !== undefined && item.fileId && item.fileId !== newFileId) {
      await this.files.removeFile(item.fileId)
    }
    return updated
  }

  async remove(user: AuthUser, id: string) {
    const item = await this.load(id)
    assertCanManage(user, item)
    await this.prisma.libraryItem.delete({ where: { id } })
    await this.files.removeFile(item.fileId)
  }

  /** Ссылка на скачивание файла материала. */
  async fileLink(user: AuthUser, id: string) {
    if (!READERS.includes(user.role)) throw new ForbiddenException('Нет доступа')
    const item = await this.load(id)
    assertSameSchool(user, item.kindergartenId)
    if (!item.fileId) throw new NotFoundException('У материала нет файла — откройте его по ссылке')
    const file = await this.prisma.storedFile.findUnique({ where: { id: item.fileId } })
    if (!file) throw new NotFoundException('Файл удалён')
    return this.files.createLink(file)
  }
}
