import { ForbiddenException, Injectable } from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

/**
 * Кто имеет доступ к классу. Единое место для правил, которые раньше
 * копировались по сервисам (teacherGroupIds в students, school, chat…).
 *
 *  - SUPER_ADMIN / ADMIN — любые классы своей школы;
 *  - TEACHER — классы, которые он ведёт (основной + teachingGroups);
 *  - классный руководитель — учитель с Group.homeroomTeacherId = он сам
 *    (расширенные права на свой класс: сводка, связь с родителями,
 *    доступ ученикам).
 */
@Injectable()
export class ClassAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser): boolean {
    return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
  }

  /** Все классы, которые ведёт учитель: основная группа + M:N. */
  async teacherGroupIds(user: AuthUser): Promise<string[]> {
    const me = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { groupId: true, teachingGroups: { select: { id: true } } },
    })
    return Array.from(
      new Set(
        [me?.groupId, ...(me?.teachingGroups.map((g) => g.id) ?? [])].filter(
          (x): x is string => !!x,
        ),
      ),
    )
  }

  /**
   * Сотрудник школы работает с классом (отметки, ДЗ, сообщения родителям).
   * Админ — любой класс своей школы; учитель — только свои классы.
   */
  async assertStaffAccess(
    user: AuthUser,
    group: { id: string; kindergartenId: string | null },
  ): Promise<void> {
    if (user.kindergartenId && group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Класс из другой школы')
    }
    if (this.isAdmin(user)) return
    if (user.role === 'TEACHER' && (await this.teacherGroupIds(user)).includes(group.id)) return
    throw new ForbiddenException('Это не ваш класс')
  }

  /** Расширенные права: админ школы или классный руководитель этого класса. */
  async assertHomeroomAccess(
    user: AuthUser,
    group: { id: string; kindergartenId: string | null; homeroomTeacherId: string | null },
  ): Promise<void> {
    if (user.kindergartenId && group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Класс из другой школы')
    }
    if (this.isAdmin(user)) return
    if (user.role === 'TEACHER' && group.homeroomTeacherId === user.sub) return
    throw new ForbiddenException('Только классный руководитель этого класса')
  }
}
