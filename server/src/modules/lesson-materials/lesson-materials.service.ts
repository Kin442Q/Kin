import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { assertCanManage, requireSchool } from '../../common/content-access'
import type { AuthUser } from '../../common/types/jwt-payload'
import { ClassAccessService } from '../class-access/class-access.service'
import { FilesService, toFileView } from '../files/files.service'
import { CreateLessonMaterialDto, LESSON_MATERIAL_TTL_DAYS } from './lesson-materials.dto'

const DAY_MS = 24 * 60 * 60 * 1000

const INCLUDE = {
  subject: { select: { id: true, name: true, color: true } },
  group: { select: { id: true, name: true } },
  author: { select: { id: true, fullName: true } },
  file: { select: { id: true, name: true, size: true, mime: true } },
} satisfies Prisma.LessonMaterialInclude

type MaterialRow = Prisma.LessonMaterialGetPayload<{ include: typeof INCLUDE }>

@Injectable()
export class LessonMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classAccess: ClassAccessService,
    private readonly files: FilesService,
  ) {}

  private view(m: MaterialRow, now = new Date()) {
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      url: m.url,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
      daysLeft: Math.max(0, Math.ceil((m.expiresAt.getTime() - now.getTime()) / DAY_MS)),
      subject: m.subject,
      group: m.group,
      author: m.author,
      file: m.file ? toFileView(m.file) : null,
    }
  }

  /**
   * Классы, материалы которых видит пользователь: ученик — свой, родитель —
   * классы своих детей, учитель — свои, админ школы — все.
   */
  private async visibleGroupIds(user: AuthUser): Promise<string[] | 'all'> {
    const role = user.role
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'all'
    if (role === 'TEACHER') return this.classAccess.teacherGroupIds(user)
    if (role === 'STUDENT') {
      if (!user.studentId) return []
      const s = await this.prisma.student.findUnique({ where: { id: user.studentId }, select: { groupId: true } })
      return s?.groupId ? [s.groupId] : []
    }
    if (role === 'PARENT') {
      const kids = await this.prisma.student.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ id: user.childId ?? '__none__' }, { parents: { some: { id: user.sub } } }],
        },
        select: { groupId: true },
      })
      return Array.from(new Set(kids.map((k) => k.groupId).filter((g): g is string => !!g)))
    }
    return []
  }

  async list(user: AuthUser, params: { groupId?: string; subjectId?: string }) {
    const kindergartenId = requireSchool(user)
    const visible = await this.visibleGroupIds(user)
    if (visible !== 'all' && visible.length === 0) return []
    if (params.groupId && visible !== 'all' && !visible.includes(params.groupId)) {
      throw new ForbiddenException('Нет доступа к этому классу')
    }

    const now = new Date()
    const where: Prisma.LessonMaterialWhereInput = {
      kindergartenId,
      // истёкшие скрываем сразу, не дожидаясь ночной чистки
      expiresAt: { gt: now },
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
      ...(params.groupId
        ? { groupId: params.groupId }
        : visible === 'all'
          ? {}
          : { groupId: { in: visible } }),
    }
    const rows = await this.prisma.lessonMaterial.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((m) => this.view(m, now))
  }

  async create(user: AuthUser, dto: CreateLessonMaterialDto) {
    const kindergartenId = requireSchool(user)

    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      select: { id: true, kindergartenId: true },
    })
    if (!group) throw new NotFoundException('Класс не найден')
    await this.classAccess.assertStaffAccess(user, group)

    if (dto.subjectId) {
      const s = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, kindergartenId },
        select: { id: true },
      })
      if (!s) throw new NotFoundException('Предмет не найден')
    }

    const description = dto.description?.trim() || null
    const url = dto.url?.trim() || null
    if (!description && !url && !dto.fileId) {
      throw new BadRequestException('Добавьте файл, ссылку или описание')
    }

    const file = dto.fileId ? await this.files.claim(user, dto.fileId) : null
    try {
      const row = await this.prisma.lessonMaterial.create({
        data: {
          kindergartenId,
          groupId: group.id,
          subjectId: dto.subjectId || null,
          title: dto.title.trim(),
          description,
          url,
          fileId: file?.id ?? null,
          authorId: user.sub,
          expiresAt: new Date(Date.now() + LESSON_MATERIAL_TTL_DAYS * DAY_MS),
        },
        include: INCLUDE,
      })
      return this.view(row)
    } catch (e) {
      // не удалось создать запись — отпустить файл, чтобы его убрала чистка
      if (file) await this.prisma.storedFile.update({ where: { id: file.id }, data: { attached: false } }).catch(() => undefined)
      throw e
    }
  }

  private async load(id: string) {
    const m = await this.prisma.lessonMaterial.findUnique({ where: { id } })
    if (!m || m.expiresAt.getTime() <= Date.now()) throw new NotFoundException('Материал не найден или уже удалён')
    return m
  }

  async remove(user: AuthUser, id: string) {
    const m = await this.load(id)
    assertCanManage(user, m)
    await this.prisma.lessonMaterial.delete({ where: { id } })
    await this.files.removeFile(m.fileId)
  }

  /** Ссылка на скачивание файла материала — только тем, кто видит этот класс. */
  async fileLink(user: AuthUser, id: string) {
    const m = await this.load(id)
    if (user.kindergartenId && user.kindergartenId !== m.kindergartenId) {
      throw new ForbiddenException('Это материал другой школы')
    }
    const visible = await this.visibleGroupIds(user)
    if (visible !== 'all' && !visible.includes(m.groupId)) throw new ForbiddenException('Нет доступа к этому классу')
    if (!m.fileId) throw new NotFoundException('У материала нет файла')
    const file = await this.prisma.storedFile.findUnique({ where: { id: m.fileId } })
    if (!file) throw new NotFoundException('Файл удалён')
    return this.files.createLink(file)
  }
}
