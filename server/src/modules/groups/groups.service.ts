import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { FeaturesService } from '../features/features.service'
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto'
import type { AuthUser } from '../../common/types/jwt-payload'

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly features: FeaturesService,
  ) {}

  /**
   * Список групп. Учитель видит только свою; админы — все группы своего садика.
   */
  async findAll(user: AuthUser) {
    if (user.role === 'TEACHER') {
      // Учитель видит все классы, которые ведёт: основную группу + M:N teachingGroups.
      const me = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: {
          groupId: true,
          teachingGroups: { select: { id: true } },
        },
      })
      const ids = Array.from(
        new Set(
          [me?.groupId, ...(me?.teachingGroups.map((g) => g.id) ?? [])].filter(
            (x): x is string => !!x,
          ),
        ),
      )
      if (ids.length === 0) return []
      return this.prisma.group.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { students: true, teachers: true } },
          homeroomTeacher: { select: { id: true, fullName: true } },
        },
      })
    }
    return this.prisma.group.findMany({
      where: user.kindergartenId
        ? { kindergartenId: user.kindergartenId }
        : {},
      orderBy: { createdAt: 'asc' },
      include: {
          _count: { select: { students: true, teachers: true } },
          homeroomTeacher: { select: { id: true, fullName: true } },
        },
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
        homeroomTeacher: { select: { id: true, fullName: true } },
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
    const { homeroomTeacherId, ...rest } = dto
    if (homeroomTeacherId) await this.assertHomeroomTeacher(user, homeroomTeacherId)

    const data: Prisma.GroupUncheckedCreateInput = {
      ...(rest as Prisma.GroupUncheckedCreateInput),
      ageRange: dto.ageRange ?? '',
      kindergartenId: user.kindergartenId,
      homeroomTeacherId: homeroomTeacherId ?? null,
    }
    const g = await this.prisma.group.create({ data })
    if (homeroomTeacherId) await this.giveClassAccess(homeroomTeacherId, g.id)
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

    // Явно строим update-объект чтобы Decimal-поля (monthlyFee,
    // fixedMonthlyExpense) корректно сохранились и не потерялись
    // через PartialType-DTO.
    const data: Prisma.GroupUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.ageRange !== undefined) data.ageRange = dto.ageRange
    if (dto.color !== undefined) data.color = dto.color
    if (dto.capacity !== undefined) data.capacity = dto.capacity
    if (dto.isActive !== undefined) data.isActive = dto.isActive
    if (dto.monthlyFee !== undefined) {
      data.monthlyFee = Number(dto.monthlyFee) as any
    }
    if (dto.fixedMonthlyExpense !== undefined) {
      data.fixedMonthlyExpense = Number(dto.fixedMonthlyExpense) as any
    }
    if (dto.homeroomTeacherId !== undefined) {
      if (dto.homeroomTeacherId) {
        await this.assertHomeroomTeacher(user, dto.homeroomTeacherId)
        data.homeroomTeacher = { connect: { id: dto.homeroomTeacherId } }
      } else {
        data.homeroomTeacher = { disconnect: true }
      }
    }

    this.logger.log(
      `[groups] update ${id}: ${JSON.stringify({
        monthlyFee: data.monthlyFee,
        fixedMonthlyExpense: data.fixedMonthlyExpense,
      })}`,
    )

    const g = await this.prisma.group.update({ where: { id }, data })
    if (dto.homeroomTeacherId) await this.giveClassAccess(dto.homeroomTeacherId, id)
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

  /**
   * Классным руководителем может быть только активный учитель этой же школы,
   * и только если раздел «Классный руководитель» включён. Чужой учитель — 404.
   */
  private async assertHomeroomTeacher(user: AuthUser, teacherId: string) {
    if (!(await this.features.isEnabled(user.kindergartenId, 'homeroom'))) {
      throw new ForbiddenException('Раздел «Классный руководитель» отключён для вашей школы')
    }
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { role: true, isActive: true, kindergartenId: true },
    })
    if (
      !teacher ||
      teacher.role !== 'TEACHER' ||
      (user.kindergartenId && teacher.kindergartenId !== user.kindergartenId)
    ) {
      throw new NotFoundException('Учитель не найден')
    }
    if (!teacher.isActive) {
      throw new BadRequestException('Учитель отключён')
    }
  }

  /** Классный руководитель обязан вести свой класс — иначе у него не будет доступа к нему. */
  private async giveClassAccess(teacherId: string, groupId: string) {
    await this.prisma.user.update({
      where: { id: teacherId },
      data: { teachingGroups: { connect: { id: groupId } } },
    })
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
