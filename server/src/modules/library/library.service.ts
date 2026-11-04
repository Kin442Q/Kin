import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { assertCanManage, requireSchool } from '../../common/content-access'
import type { AuthUser } from '../../common/types/jwt-payload'
import type { CreateLibraryItemDto, LibraryType, UpdateLibraryItemDto } from './library.dto'

const READERS = ['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
        subject: { select: { id: true, name: true, color: true } },
        author: { select: { id: true, fullName: true } },
      },
    })
  }

  async create(user: AuthUser, dto: CreateLibraryItemDto) {
    const kindergartenId = requireSchool(user)
    await this.assertSubject(kindergartenId, dto.subjectId)
    return this.prisma.libraryItem.create({
      data: {
        kindergartenId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        url: dto.url.trim(),
        subjectId: dto.subjectId || null,
        gradeNumber: dto.gradeNumber ?? null,
        authorId: user.sub,
      },
    })
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
    if (dto.url !== undefined) data.url = dto.url.trim()
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId || null
    if (dto.gradeNumber !== undefined) data.gradeNumber = dto.gradeNumber ?? null
    return this.prisma.libraryItem.update({ where: { id }, data })
  }

  async remove(user: AuthUser, id: string) {
    const item = await this.load(id)
    assertCanManage(user, item)
    await this.prisma.libraryItem.delete({ where: { id } })
  }
}
