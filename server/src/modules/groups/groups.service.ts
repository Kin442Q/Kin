import { Injectable, NotFoundException } from '@nestjs/common'
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
   * Список групп. Учитель видит только свою; админы — все.
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
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { students: true, teachers: true } } },
    })
  }

  async findOne(id: string) {
    const g = await this.prisma.group.findUnique({
      where: { id },
      include: {
        teachers: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: { select: { students: true } },
      },
    })
    if (!g) throw new NotFoundException('Группа не найдена')
    return g
  }

  async create(dto: CreateGroupDto) {
    const g = await this.prisma.group.create({ data: dto as Prisma.GroupCreateInput })
    await this.invalidateCache()
    return g
  }

  async update(id: string, dto: UpdateGroupDto) {
    const g = await this.prisma.group.update({ where: { id }, data: dto })
    await this.invalidateCache(id)
    return g
  }

  async remove(id: string) {
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
