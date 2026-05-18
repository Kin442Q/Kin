import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, StudentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
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

  // ─── Родительские аккаунты ученика ──────────────────────────────────

  async listParents(studentId: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        parents: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    })
    if (!s) throw new NotFoundException('Ученик не найден')
    this.assertCanAccess(user, s.groupId, s.kindergartenId)
    return s.parents
  }

  async addParent(
    studentId: string,
    dto: {
      fullName?: string
      email?: string
      phone?: string
      password?: string
      existingUserId?: string
    },
    user: AuthUser,
  ) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Только администратор может управлять родителями')
    }
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    this.assertCanAccess(user, student.groupId, student.kindergartenId)

    // Вариант 1: привязать существующего родителя
    if (dto.existingUserId) {
      const existing = await this.prisma.user.findUnique({
        where: { id: dto.existingUserId },
      })
      if (!existing) throw new NotFoundException('Пользователь не найден')
      if (existing.role !== 'PARENT') {
        throw new BadRequestException(
          'Этот пользователь не родитель — нельзя привязать к ученику',
        )
      }
      if (
        user.kindergartenId &&
        existing.kindergartenId &&
        existing.kindergartenId !== user.kindergartenId
      ) {
        throw new ForbiddenException('Родитель из другого учреждения')
      }
      await this.prisma.student.update({
        where: { id: studentId },
        data: { parents: { connect: { id: existing.id } } },
      })
      return this.serializeParent(existing)
    }

    // Вариант 2: создать новый аккаунт-родителя и привязать
    if (!dto.fullName?.trim()) {
      throw new BadRequestException('ФИО родителя обязательно')
    }
    if (!dto.email?.trim() && !dto.phone?.trim()) {
      throw new BadRequestException('Нужен email или телефон')
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Пароль минимум 6 символов')
    }

    const email = dto.email
      ? dto.email.trim().toLowerCase()
      : `parent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@no-email.local`
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ConflictException('Email уже используется')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        role: 'PARENT',
        kindergartenId: user.kindergartenId,
        // Сохраняем «основного ребёнка» для обратной совместимости с childId.
        childId: studentId,
        isActive: true,
      },
    })

    // Привязываем M:N связь
    await this.prisma.student.update({
      where: { id: studentId },
      data: { parents: { connect: { id: created.id } } },
    })

    return this.serializeParent(created)
  }

  async removeParent(studentId: string, parentId: string, user: AuthUser) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException()
    }
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    this.assertCanAccess(user, student.groupId, student.kindergartenId)

    await this.prisma.student.update({
      where: { id: studentId },
      data: { parents: { disconnect: { id: parentId } } },
    })

    // Если у родителя был только этот ребёнок в childId — сбросим
    const parent = await this.prisma.user.findUnique({
      where: { id: parentId },
      select: { childId: true },
    })
    if (parent?.childId === studentId) {
      await this.prisma.user.update({
        where: { id: parentId },
        data: { childId: null },
      })
    }
  }

  private serializeParent(u: {
    id: string
    fullName: string
    email: string
    phone: string | null
    isActive: boolean
  }) {
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
    }
  }
}
