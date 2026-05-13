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

  // TODO: salaries — CRUD по модели Salary
}
