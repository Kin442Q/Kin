import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto'
import type { AuthUser } from '../../common/types/jwt-payload'

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Список групп. Учитель видит только свою; админы — все группы своего садика.
   */
  async findAll(user: AuthUser) {
    if (user.role === 'TEACHER') {
      if (!user.groupId) return []
      const g = await this.prisma.group.findUnique({
        where: { id: user.groupId },
        include: { _count: { select: { students: true, teachers: true } } },
      })
      return g ? [g] : []
    }
    return this.prisma.group.findMany({
      where: user.kindergartenId
        ? { kindergartenId: user.kindergartenId }
        : {},
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { students: true, teachers: true } } },
    })
  }

  async findOne(user: AuthUser, id: string) {
    const g = await this.prisma.group.findUnique({
      where: { id },
      include: {
        teachers: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        _count: { select: { students: true } },
      },
    })
    if (!g) throw new NotFoundException('Группа не найдена')
    if (user.kindergartenId && g.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Группа из другого садика')
    }
    return g
  }

  async create(user: AuthUser, dto: CreateGroupDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException(
        'Глобальный супер-админ не может создавать группы без указания садика',
      )
    }
    const data: Prisma.GroupUncheckedCreateInput = {
      ...(dto as Prisma.GroupUncheckedCreateInput),
      kindergartenId: user.kindergartenId,
    }
    const g = await this.prisma.group.create({ data })
    await this.invalidateCache()
    return g
  }

  async update(user: AuthUser, id: string, dto: UpdateGroupDto) {
    const existing = await this.prisma.group.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Группа не найдена')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Группа из другого садика')
    }
    const g = await this.prisma.group.update({ where: { id }, data: dto })
    await this.invalidateCache(id)
    return g
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.group.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Группа не найдена')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Группа из другого садика')
    }
    await this.prisma.group.delete({ where: { id } })
    await this.invalidateCache(id)
  }

  // -------------------------------------------------------
  private async invalidateCache(id?: string) {
    if (id) {
      await this.redis.delByPattern(`finance:group:${id}:*`)
      await this.redis.delByPattern(`analytics:group:${id}:*`)
    }
    await this.redis.delByPattern('analytics:dashboard:*')
  }
}
