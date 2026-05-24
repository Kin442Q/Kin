import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'

/**
 * Сервис учителей. Учителя — это users с role=TEACHER.
 * Здесь компактные list/assign-операции; CRUD юзеров — в UsersModule.
 */
@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { role: 'TEACHER' },
      select: {
        id: true, fullName: true, email: true, phone: true, groupId: true, isActive: true,
        teachingGroups: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    })
  }

  assignGroup(id: string, groupId: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: { groupId },
    })
  }

  /**
   * Назначить учителю набор классов (many-to-many). Первый из списка
   * становится основной группой (groupId) для совместимости со старой логикой.
   */
  async setClasses(id: string, groupIds: string[]) {
    const ids = Array.from(new Set((groupIds || []).filter(Boolean)))
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

  // TODO: salaries — CRUD по модели Salary
}
