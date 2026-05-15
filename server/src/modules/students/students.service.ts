import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, StudentStatus } from '@prisma/client'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto'
import type { AuthUser } from '../../common/types/jwt-payload'

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список учеников. TEACHER видит только свою группу.
   * SUPER_ADMIN/ADMIN — все, опционально с фильтром по groupId.
   */
  async findAll(user: AuthUser, params: { groupId?: string; status?: StudentStatus }) {
    const where: Prisma.StudentWhereInput = {}

    // Multi-tenant: фильтр по садику (кроме глобального супер-админа без садика)
    if (user.kindergartenId) {
      where.kindergartenId = user.kindergartenId
    }

    if (user.role === 'TEACHER') {
      if (!user.groupId) return []
      where.groupId = user.groupId
    } else if (params.groupId) {
      where.groupId = params.groupId
    }
    if (params.status) where.status = params.status

    return this.prisma.student.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: { group: { select: { id: true, name: true, color: true } } },
    })
  }

  async findOne(id: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!s) throw new NotFoundException('Ученик не найден')
    this.assertCanAccess(user, s.groupId, s.kindergartenId)
    return s
  }

  async create(dto: CreateStudentDto, user: AuthUser) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    // TEACHER может добавлять только в свою группу.
    if (user.role === 'TEACHER') {
      if (!user.groupId) throw new ForbiddenException('Не назначена группа')
      dto.groupId = user.groupId
    }

    // Проверяем что группа принадлежит этому садику
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
    })
    if (!group) throw new NotFoundException('Группа не найдена')
    if (group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Группа из другого садика')
    }

    return this.prisma.student.create({
      data: {
        ...dto,
        birthDate: new Date(dto.birthDate),
        kindergartenId: user.kindergartenId,
      },
    })
  }

  async update(id: string, dto: UpdateStudentDto, user: AuthUser) {
    const existing = await this.prisma.student.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Ученик не найден')
    this.assertCanAccess(user, existing.groupId, existing.kindergartenId)

    // Учитель не может перевести ребёнка в другую группу.
    if (user.role === 'TEACHER' && dto.groupId && dto.groupId !== existing.groupId) {
      throw new ForbiddenException('Нельзя сменить группу')
    }

    return this.prisma.student.update({
      where: { id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    })
  }

  async archive(id: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({ where: { id } })
    if (!s) throw new NotFoundException('Ученик не найден')
    this.assertCanAccess(user, s.groupId, s.kindergartenId)
    return this.prisma.student.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
  }

  async remove(id: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({ where: { id } })
    if (!s) throw new NotFoundException('Ученик не найден')
    this.assertCanAccess(user, s.groupId, s.kindergartenId)
    await this.prisma.student.delete({ where: { id } })
  }

  // -------------------------------------------------------
  private assertCanAccess(
    user: AuthUser,
    studentGroupId: string,
    studentKindergartenId?: string | null,
  ) {
    if (user.kindergartenId && studentKindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Ученик из другого садика')
    }
    if (user.role === 'TEACHER' && user.groupId !== studentGroupId) {
      throw new ForbiddenException('Ученик не из вашей группы')
    }
  }
}
