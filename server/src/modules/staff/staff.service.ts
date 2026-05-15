import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { StaffPosition } from '@prisma/client'
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
}

@Injectable()
export class StaffService {
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

    // Если указана группа — проверить что она в этом же садике
    if (dto.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      })
      if (!group) throw new NotFoundException('Группа не найдена')
      if (group.kindergartenId !== user.kindergartenId) {
        throw new ForbiddenException('Группа из другого садика')
      }
    }

    return this.prisma.staff.create({
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
      },
    })
  }

  async update(user: AuthUser, id: string, dto: UpdateStaffDto) {
    const existing = await this.prisma.staff.findUnique({ where: { id } })
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
    await this.prisma.staff.delete({ where: { id } })
    return { success: true }
  }
}
