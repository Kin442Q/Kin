import { ForbiddenException } from '@nestjs/common'
import type { AuthUser } from './types/jwt-payload'

/**
 * Права на учебный контент школы: библиотека, квизы, направления подготовки.
 *  - читать может любой пользователь своей школы (кому разрешает роль ручки);
 *  - создавать — сотрудники школы (учитель, админ);
 *  - менять и удалять — автор или админ школы.
 */

export const isAdminRole = (user: AuthUser) => user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

/** Школа пользователя; владелец платформы (без школы) создавать контент не может. */
export function requireSchool(user: AuthUser): string {
  if (!user.kindergartenId) {
    throw new ForbiddenException('Контент создаётся внутри школы — войдите как сотрудник школы')
  }
  return user.kindergartenId
}

/** Объект чужой школы для пользователя школы недоступен. */
export function assertSameSchool(user: AuthUser, kindergartenId: string): void {
  if (user.kindergartenId && user.kindergartenId !== kindergartenId) {
    throw new ForbiddenException('Это материал другой школы')
  }
}

/** Менять/удалять: админ своей школы или автор материала. */
export function assertCanManage(
  user: AuthUser,
  content: { authorId: string | null; kindergartenId: string },
): void {
  assertSameSchool(user, content.kindergartenId)
  if (isAdminRole(user)) return
  if (user.role === 'TEACHER' && content.authorId === user.sub) return
  throw new ForbiddenException('Редактировать может только автор или администратор школы')
}
