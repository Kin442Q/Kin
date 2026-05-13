import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Только SUPER_ADMIN/ADMIN — список всех пользователей. */
  list() {
    return this.prisma.user.findMany({
      select: {
        id: true, email: true, fullName: true, role: true,
        groupId: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive } })
  }
}
