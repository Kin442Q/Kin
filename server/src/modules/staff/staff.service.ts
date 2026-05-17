import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { StaffPosition, Prisma } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

interface CreateStaffDto {
  firstName: string
  lastName: string
  middleName?: string
  position: StaffPosition
  phone: string
  email?: string
  groupId?: string | null
  salary: number
  hireDate: string

  // ─── Опции учётки для входа в систему ─────────────────────────
  /** Создать связанную User-запись для входа в систему */
  canLogin?: boolean
  /** Пароль для входа (нужен если canLogin=true и нет существующего User) */
  password?: string
  /** Роль: по умолчанию TEACHER */
  role?: 'TEACHER' | 'ADMIN'

  // ─── Time-tracking параметры (для тех у кого есть учётка) ──────
  salaryMode?: 'HOURLY' | 'FIXED'
  hourlyRate?: number
  monthlySalaryFixed?: number
  workNorm?: number
  terminalCode?: string
}

interface UpdateStaffDto {
  firstName?: string
  lastName?: string
  middleName?: string
  position?: StaffPosition
  phone?: string
  email?: string
  groupId?: string | null
  salary?: number
  hireDate?: string

  canLogin?: boolean
  password?: string
  role?: 'TEACHER' | 'ADMIN'
  salaryMode?: 'HOURLY' | 'FIXED'
  hourlyRate?: number
  monthlySalaryFixed?: number
  workNorm?: number
  terminalCode?: string
}

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name)

  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, params: { position?: StaffPosition }) {
    return this.prisma.staff.findMany({
      where: {
        ...(user.kindergartenId
          ? { kindergartenId: user.kindergartenId }
          : {}),
        ...(params.position ? { position: params.position } : {}),
      },
      orderBy: { hireDate: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            salaryMode: true,
            hourlyRate: true,
            monthlySalaryFixed: true,
            workNorm: true,
            terminalCode: true,
          },
        },
      },
    })
  }

  async create(user: AuthUser, dto: CreateStaffDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      throw new BadRequestException('Имя и фамилия обязательны')
    }
    if (!dto.phone?.trim()) {
      throw new BadRequestException('Телефон обязателен')
    }

    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      })
      if (!group) throw new NotFoundException('Группа не найдена')
      if (group.kindergartenId !== user.kindergartenId) {
        throw new ForbiddenException('Группа из другого садика')
      }
    }

    // Если просят создать учётку — сначала создаём User, потом Staff с userId
    let userId: string | null = null
    if (dto.canLogin) {
      if (!dto.password || dto.password.length < 6) {
        throw new BadRequestException(
          'Для входа нужен пароль не короче 6 символов',
        )
      }
      const email =
        dto.email?.trim() ||
        `staff-${Date.now()}@kindergarten.local`

      const existing = await this.prisma.user.findUnique({ where: { email } })
      if (existing) {
        throw new ConflictException(
          `Пользователь с email ${email} уже существует`,
        )
      }

      const passwordHash = await bcrypt.hash(dto.password, 10)
      const newUser = await this.prisma.user.create({
        data: {
          email,
          phone: dto.phone.trim(),
          passwordHash,
          fullName:
            `${dto.lastName.trim()} ${dto.firstName.trim()}`.trim(),
          role: dto.role || 'TEACHER',
          kindergartenId: user.kindergartenId,
          groupId: dto.groupId || null,
          isActive: true,
          salaryMode: dto.salaryMode || 'HOURLY',
          hourlyRate: dto.hourlyRate as any,
          monthlySalaryFixed: dto.monthlySalaryFixed as any,
          workNorm: dto.workNorm || 176,
          terminalCode: dto.terminalCode || null,
        },
      })
      userId = newUser.id
    }

    const staff = await this.prisma.staff.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        middleName: dto.middleName?.trim() || null,
        position: dto.position,
        phone: dto.phone.trim(),
        email: dto.email?.trim() || null,
        groupId: dto.groupId || null,
        salary: dto.salary || 0,
        hireDate: new Date(dto.hireDate),
        kindergartenId: user.kindergartenId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            salaryMode: true,
            hourlyRate: true,
            monthlySalaryFixed: true,
            workNorm: true,
            terminalCode: true,
          },
        },
      },
    })

    this.logger.log(
      `[staff] created ${staff.firstName} ${staff.lastName} (${staff.position})${
        userId ? ` + login user ${userId}` : ''
      }`,
    )

    return staff
  }

  async update(user: AuthUser, id: string, dto: UpdateStaffDto) {
    const existing = await this.prisma.staff.findUnique({
      where: { id },
      include: { user: true },
    })
    if (!existing) throw new NotFoundException('Сотрудник не найден')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Сотрудник из другого садика')
    }

    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      })
      if (!group) throw new NotFoundException('Группа не найдена')
      if (
        user.kindergartenId &&
        group.kindergartenId !== user.kindergartenId
      ) {
        throw new ForbiddenException('Группа из другого садика')
      }
    }

    // Если включают canLogin — создаём связанную учётку
    let userIdToSet: string | null | undefined = undefined
    if (dto.canLogin && !existing.userId) {
      if (!dto.password || dto.password.length < 6) {
        throw new BadRequestException(
          'Для включения входа нужен пароль не короче 6 символов',
        )
      }
      const email =
        dto.email?.trim() ||
        existing.email ||
        `staff-${Date.now()}@kindergarten.local`

      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      })
      if (existingUser) {
        throw new ConflictException(
          `Пользователь с email ${email} уже существует`,
        )
      }

      const passwordHash = await bcrypt.hash(dto.password, 10)
      const newUser = await this.prisma.user.create({
        data: {
          email,
          phone: dto.phone?.trim() || existing.phone,
          passwordHash,
          fullName: `${dto.lastName?.trim() || existing.lastName} ${dto.firstName?.trim() || existing.firstName}`.trim(),
          role: dto.role || 'TEACHER',
          kindergartenId: existing.kindergartenId,
          groupId: dto.groupId !== undefined ? dto.groupId : existing.groupId,
          isActive: true,
          salaryMode: dto.salaryMode || 'HOURLY',
          hourlyRate: dto.hourlyRate as any,
          monthlySalaryFixed: dto.monthlySalaryFixed as any,
          workNorm: dto.workNorm || 176,
          terminalCode: dto.terminalCode || null,
        },
      })
      userIdToSet = newUser.id
    }

    // Если уже есть связанная учётка — обновляем её параметры
    if (existing.userId) {
      const userUpdate: Prisma.UserUpdateInput = {}
      if (dto.firstName || dto.lastName) {
        userUpdate.fullName =
          `${dto.lastName?.trim() || existing.lastName} ${dto.firstName?.trim() || existing.firstName}`.trim()
      }
      if (dto.phone) userUpdate.phone = dto.phone.trim()
      if (dto.email) userUpdate.email = dto.email.trim()
      if (dto.role) userUpdate.role = dto.role as any
      if (dto.salaryMode) userUpdate.salaryMode = dto.salaryMode as any
      if (dto.hourlyRate !== undefined)
        userUpdate.hourlyRate = dto.hourlyRate as any
      if (dto.monthlySalaryFixed !== undefined)
        userUpdate.monthlySalaryFixed = dto.monthlySalaryFixed as any
      if (dto.workNorm !== undefined) userUpdate.workNorm = dto.workNorm
      if (dto.terminalCode !== undefined)
        userUpdate.terminalCode = dto.terminalCode || null
      if (dto.groupId !== undefined) {
        userUpdate.group = dto.groupId
          ? { connect: { id: dto.groupId } }
          : { disconnect: true }
      }
      if (dto.password && dto.password.length >= 6) {
        userUpdate.passwordHash = await bcrypt.hash(dto.password, 10)
      }
      if (Object.keys(userUpdate).length > 0) {
        await this.prisma.user.update({
          where: { id: existing.userId },
          data: userUpdate,
        })
      }
    }

    return this.prisma.staff.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        middleName: dto.middleName?.trim(),
        position: dto.position,
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
        groupId:
          dto.groupId !== undefined ? dto.groupId || null : undefined,
        salary: dto.salary,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        userId: userIdToSet,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            salaryMode: true,
            hourlyRate: true,
            monthlySalaryFixed: true,
            workNorm: true,
            terminalCode: true,
          },
        },
      },
    })
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.staff.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Сотрудник не найден')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Сотрудник из другого садика')
    }
    // Связанная учётка User остаётся (отвязывается через onDelete: SetNull)
    await this.prisma.staff.delete({ where: { id } })
    return { success: true }
  }
}
