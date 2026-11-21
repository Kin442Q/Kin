import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import type { AuthUser } from '../../common/types/jwt-payload'

/** Сколько учеников можно удалить одним запросом. */
export const BULK_DELETE_MAX = 1000
/** Сколько учеников удаляется в одной транзакции: 300 учеников не должны висеть в одной огромной. */
export const BULK_DELETE_CHUNK = 100

export interface BulkDeleteResult {
  deleted: number
  failed: Array<{ id: string; reason: string }>
}

/**
 * Пакетное удаление учеников.
 *
 * Смысл тот же, что у `DELETE /students/:id` (`StudentsService.remove`): это настоящее удаление,
 * а не архив. Оценки, посещаемость, платежи, заметки, ответы на ДЗ, результаты викторин и
 * вердикты удаляются каскадом (onDelete: Cascade в схеме). Родительские аккаунты остаются, но
 * отвязываются от ученика (как при одиночном удалении).
 *
 * Отличия от одиночного: личный вход ученика (роль STUDENT) удаляется вместе с ним, чтобы не
 * оставались «висящие» аккаунты без ученика; чужие и несуществующие id не удаляются, а
 * возвращаются в `failed`.
 */
@Injectable()
export class StudentsBulkDeleteService {
  private readonly logger = new Logger(StudentsBulkDeleteService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async bulkDelete(user: AuthUser, rawIds: unknown): Promise<BulkDeleteResult> {
    // Удалять учеников может только администратор школы (как и @Roles на DELETE /students/:id).
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Удалять учеников может только администратор школы')
    }
    if (!Array.isArray(rawIds)) {
      throw new BadRequestException('Передайте список учеников (ids)')
    }
    if (rawIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одного ученика')
    }
    if (rawIds.length > BULK_DELETE_MAX) {
      throw new BadRequestException(
        `За один раз можно удалить не больше ${BULK_DELETE_MAX} учеников`,
      )
    }
    if (!rawIds.every((x) => typeof x === 'string' && x.trim().length > 0)) {
      throw new BadRequestException('Список ids должен состоять из непустых строк')
    }
    const ids = Array.from(new Set((rawIds as string[]).map((x) => x.trim())))

    // Находим учеников и отсекаем чужие школы. Чужой и несуществующий id неотличимы для вызывающего:
    // оба «не найден», чтобы нельзя было перебором выяснить, какие id есть в других школах.
    const found = await this.prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, kindergartenId: true },
    })
    const mine = new Set(
      found
        .filter((s) => !user.kindergartenId || s.kindergartenId === user.kindergartenId)
        .map((s) => s.id),
    )
    const failed: BulkDeleteResult['failed'] = []
    const toDelete: string[] = []
    for (const id of ids) {
      if (mine.has(id)) toDelete.push(id)
      else failed.push({ id, reason: 'Ученик не найден' })
    }

    let deleted = 0
    const deletedIds: string[] = []
    for (let i = 0; i < toDelete.length; i += BULK_DELETE_CHUNK) {
      const chunk = toDelete.slice(i, i + BULK_DELETE_CHUNK)
      try {
        deleted += await this.deleteChunk(chunk)
        deletedIds.push(...chunk)
      } catch (err) {
        // Пачка не прошла (например, ученика в этот момент меняли): разбираем по одному,
        // чтобы одна проблемная запись не мешала остальным, и честно сообщаем, что не удалось.
        this.logger.warn(`[students.bulkDelete] пачка из ${chunk.length} не удалилась: ${errText(err)}`)
        for (const id of chunk) {
          try {
            deleted += await this.deleteChunk([id])
            deletedIds.push(id)
          } catch (err2) {
            this.logger.warn(`[students.bulkDelete] ${id} не удалён: ${errText(err2)}`)
            failed.push({ id, reason: 'Не удалось удалить, попробуйте ещё раз' })
          }
        }
      }
    }

    this.logger.log(
      `[students.bulkDelete] user=${user.sub} запрошено=${rawIds.length} удалено=${deleted} не удалено=${failed.length}`,
    )
    if (deleted > 0) {
      await this.invalidateCaches(user)
      await this.audit(user, deleted, rawIds.length, deletedIds)
    }
    return { deleted, failed }
  }

  /** Удаляет учеников пачки и их личные входы одной транзакцией. Возвращает, сколько учеников удалено. */
  private async deleteChunk(ids: string[]): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        // Вход ученика (STUDENT) без самого ученика бесполезен: в схеме связь «обнуляется»,
        // и аккаунт остался бы висеть. Удаляем его вместе с учеником.
        await tx.user.deleteMany({ where: { role: 'STUDENT', studentId: { in: ids } } })
        const r = await tx.student.deleteMany({ where: { id: { in: ids } } })
        return r.count
      },
      { timeout: 60_000 },
    )
  }

  /** Сводки (панель, финансы, аналитика) кэшируются по школе — после удаления они устарели. */
  private async invalidateCaches(user: AuthUser) {
    const tenant = user.kindergartenId || 'global'
    try {
      await Promise.all([
        this.redis.delByPattern(`analytics:dashboard:${tenant}:*`),
        this.redis.delByPattern(`analytics:profitability:${tenant}:*`),
        this.redis.delByPattern(`analytics:trend:${tenant}:*`),
        this.redis.delByPattern(`finance:group:${tenant}:*`),
        this.redis.delByPattern(`finance:global:${tenant}:*`),
      ])
    } catch (err) {
      this.logger.warn(`[students.bulkDelete] кэш не сброшен: ${errText(err)}`)
    }
  }

  /** След в журнале: кто и сколько удалил (ФИО не пишем — только числа и id). */
  private async audit(user: AuthUser, deleted: number, requested: number, ids: string[]) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'DELETE',
          entity: 'StudentBulkDelete',
          entityId: user.kindergartenId ?? null,
          diff: { requested, deleted, ids },
        },
      })
    } catch (err) {
      this.logger.warn(`[students.bulkDelete] запись в журнал не удалась: ${errText(err)}`)
    }
  }
}

function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  // Prisma присылает многострочные тексты с запросом — для отчёта берём короткую причину.
  return msg.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) || 'Не удалось удалить'
}
