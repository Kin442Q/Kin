import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PushService } from '../push/push.module'
import { ChatService } from '../chat/chat.module'
import { FeaturesService } from '../features/features.service'
import type { AuthUser } from '../../common/types/jwt-payload'

/**
 * Сообщения сотрудников родителям конкретного ученика («ребёнок не сделал
 * ДЗ», «пропускает занятия»…). Если в школе включён чат — это обычное
 * сообщение в общий канал (родитель может ответить; уходит пуш и Telegram),
 * иначе — только пуш-уведомление.
 *
 * Доступ сотрудника к ученику проверяет вызывающий (ClassAccessService).
 */
@Injectable()
export class ParentNoticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly push: PushService,
    private readonly features: FeaturesService,
  ) {}

  /** Активные родители учеников: studentId → id родителей (M:N + legacy childId). */
  async parentIdsByStudent(studentIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, Set<string>>(studentIds.map((id) => [id, new Set()]))
    if (studentIds.length === 0) return new Map()

    const [students, legacy] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, parents: { where: { isActive: true }, select: { id: true } } },
      }),
      this.prisma.user.findMany({
        where: { role: 'PARENT', isActive: true, childId: { in: studentIds } },
        select: { id: true, childId: true },
      }),
    ])
    for (const s of students) for (const p of s.parents) result.get(s.id)?.add(p.id)
    for (const l of legacy) if (l.childId) result.get(l.childId)?.add(l.id)

    return new Map([...result].map(([id, set]) => [id, [...set]]))
  }

  /** Сколько родительских аккаунтов получит сообщение (0 — писать некому). */
  async notify(user: AuthUser, studentId: string, text: string): Promise<{ sent: number }> {
    if (await this.features.isEnabled(user.kindergartenId, 'chat')) {
      return this.chat.sendToStudentParents(user, studentId, text)
    }
    const parents = (await this.parentIdsByStudent([studentId])).get(studentId) ?? []
    if (parents.length === 0) return { sent: 0 }
    await this.push
      .sendToUsers(parents, {
        title: 'Сообщение от школы',
        body: text.slice(0, 120),
        data: { kind: 'notice', studentId },
      })
      .catch(() => {})
    return { sent: parents.length }
  }
}
