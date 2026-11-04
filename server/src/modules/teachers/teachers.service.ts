import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

/**
 * Сервис учителей. Учителя — это users с role=TEACHER.
 * Здесь компактные list/assign-операции; CRUD юзеров — в UsersModule.
 *
 * Multi-tenant: админ школы видит и меняет только учителей своей школы.
 * Глобальный владелец платформы (kindergartenId = null) видит всех.
 */
@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        role: 'TEACHER',
        ...(actor.kindergartenId ? { kindergartenId: actor.kindergartenId } : {}),
      },
      select: {
        id: true, fullName: true, email: true, phone: true, groupId: true, isActive: true,
        teachingGroups: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    })
  }

  async assignGroup(actor: AuthUser, id: string, groupId: string | null) {
    const teacher = await this.findTeacher(actor, id)
    if (groupId) await this.assertGroupsInSchool(teacher.kindergartenId, [groupId])
    return this.prisma.user.update({
      where: { id },
      data: { groupId },
    })
  }

  /**
   * Назначить учителю набор классов (many-to-many). Первый из списка
   * становится основной группой (groupId) для совместимости со старой логикой.
   */
  async setClasses(actor: AuthUser, id: string, groupIds: string[]) {
    const teacher = await this.findTeacher(actor, id)
    const ids = Array.from(new Set((groupIds || []).filter(Boolean)))
    await this.assertGroupsInSchool(teacher.kindergartenId, ids)
    return this.prisma.user.update({
      where: { id },
      data: {
        teachingGroups: { set: ids.map((gid) => ({ id: gid })) },
        groupId: ids[0] ?? null,
      },
      select: {
        id: true,
        groupId: true,
        teachingGroups: { select: { id: true, name: true } },
      },
    })
  }

  /**
   * Учитель из чужой школы для админа «не существует» (404, а не 403),
   * чтобы не раскрывать, что такой id есть в системе.
   */
  private async findTeacher(actor: AuthUser, id: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, kindergartenId: true },
    })
    if (
      !teacher ||
      teacher.role !== 'TEACHER' ||
      (actor.kindergartenId && teacher.kindergartenId !== actor.kindergartenId)
    ) {
      throw new NotFoundException('Учитель не найден')
    }
    return teacher
  }

  /** Все классы должны существовать и принадлежать той же школе, что и учитель. */
  private async assertGroupsInSchool(kindergartenId: string | null, groupIds: string[]) {
    if (groupIds.length === 0) return
    const found = await this.prisma.group.findMany({
      where: { id: { in: groupIds }, kindergartenId },
      select: { id: true },
    })
    if (found.length !== groupIds.length) {
      throw new NotFoundException('Класс не найден')
    }
  }

  // TODO: salaries — CRUD по модели Salary
}
