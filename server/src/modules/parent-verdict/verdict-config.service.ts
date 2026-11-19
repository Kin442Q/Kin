import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { validateOverrides, type ThresholdOverrides } from './verdict-config'
import { DEFAULT_THRESHOLDS, thresholdsFor, type VerdictScale, type VerdictThresholds } from './verdict-scale'

export interface EffectiveThresholds {
  thresholds: VerdictThresholds
  /** Что школа поменяла относительно значений по умолчанию. */
  overrides: ThresholdOverrides
  /** В базе лежат неверные пороги школы — они не применены, считаем по умолчанию. */
  ignored: boolean
}

/** Пороги вердикта школы: значения по умолчанию для её шкалы плюс проверенные переопределения. */
@Injectable()
export class VerdictConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** Пороги для расчёта. Неверная запись в базе не ломает расчёт: берём значения по умолчанию и говорим об этом. */
  async effective(kindergartenId: string | null, scale: VerdictScale): Promise<EffectiveThresholds> {
    const row = kindergartenId
      ? await this.prisma.verdictConfig.findUnique({ where: { kindergartenId }, select: { overrides: true } })
      : null
    if (!row) return { thresholds: thresholdsFor(scale), overrides: {}, ignored: false }
    const checked = validateOverrides(scale, row.overrides)
    if (checked.errors.length) return { thresholds: thresholdsFor(scale), overrides: {}, ignored: true }
    return { thresholds: thresholdsFor(scale, checked.overrides), overrides: checked.overrides, ignored: false }
  }

  private schoolOf(user: AuthUser): string {
    if (!user.kindergartenId) throw new ForbiddenException('Пороги настраиваются в школе')
    return user.kindergartenId
  }

  private async scaleOf(kindergartenId: string): Promise<VerdictScale> {
    const school = await this.prisma.kindergarten.findUnique({ where: { id: kindergartenId }, select: { gradeScale: true } })
    return school?.gradeScale ?? 'FIVE'
  }

  /** Текущие пороги школы пользователя (для директора). */
  async get(user: AuthUser) {
    const kindergartenId = this.schoolOf(user)
    const scale = await this.scaleOf(kindergartenId)
    const { thresholds, overrides, ignored } = await this.effective(kindergartenId, scale)
    return { scale, defaults: DEFAULT_THRESHOLDS[scale], overrides, effective: thresholds, ignored }
  }

  /** Сохраняет пороги школы. Пустой объект — вернуть значения по умолчанию. */
  async put(user: AuthUser, raw: unknown) {
    const kindergartenId = this.schoolOf(user)
    const scale = await this.scaleOf(kindergartenId)
    const { overrides, errors } = validateOverrides(scale, raw)
    if (errors.length) throw new BadRequestException(errors.join('; '))

    const before = await this.prisma.verdictConfig.findUnique({ where: { kindergartenId }, select: { overrides: true } })
    if (Object.keys(overrides).length === 0) {
      await this.prisma.verdictConfig.deleteMany({ where: { kindergartenId } })
    } else {
      const json = overrides as Prisma.InputJsonObject
      await this.prisma.verdictConfig.upsert({
        where: { kindergartenId },
        create: { kindergartenId, overrides: json, updatedById: user.sub },
        update: { overrides: json, updatedById: user.sub },
      })
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'UPDATE',
        entity: 'VerdictConfig',
        entityId: kindergartenId,
        diff: { before: (before?.overrides ?? {}) as Prisma.InputJsonValue, after: overrides as Prisma.InputJsonObject },
      },
    })
    return this.get(user)
  }
}
