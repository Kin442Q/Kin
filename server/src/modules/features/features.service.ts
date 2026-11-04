import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import {
  FEATURES,
  FEATURE_KEYS,
  isFeatureKey,
  resolveFeature,
  type FeatureGroup,
  type FeatureKey,
} from './feature-registry'

/** Состояние раздела для экрана владельца платформы. */
export interface FeatureView {
  key: FeatureKey
  label: string
  description: string
  group: FeatureGroup
  defaultEnabled: boolean
  /** Итоговое значение (переопределение школы или значение по умолчанию). */
  enabled: boolean
  /** Владелец явно переопределил значение по умолчанию. */
  overridden: boolean
}

interface SchoolState {
  overrides: Map<string, boolean>
}

/** Как долго держим состояние школы в памяти (мс). */
const CACHE_TTL_MS = 30_000

@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name)
  private readonly cache = new Map<string, { state: SchoolState; expires: number }>()

  constructor(private readonly prisma: PrismaService) {}

  /** Ключи разделов, включённых для учреждения. Владельцу платформы (null) — все. */
  async enabledKeys(kindergartenId: string | null | undefined): Promise<FeatureKey[]> {
    if (!kindergartenId) return [...FEATURE_KEYS]
    const state = await this.getState(kindergartenId)
    if (!state) return []
    return FEATURE_KEYS.filter((k) => resolveFeature(k, state.overrides.get(k)))
  }

  async isEnabled(kindergartenId: string | null | undefined, key: FeatureKey): Promise<boolean> {
    if (!kindergartenId) return true
    if (!isFeatureKey(key)) {
      // Опечатка в @Feature(...) — закрываем раздел, а не открываем.
      this.logger.error(`Неизвестный раздел "${key}" в @Feature`)
      return false
    }
    const state = await this.getState(kindergartenId)
    if (!state) return false
    return resolveFeature(key, state.overrides.get(key))
  }

  /** Все разделы с состоянием для учреждения (экран владельца). */
  async listForSchool(kindergartenId: string): Promise<FeatureView[]> {
    const state = await this.loadState(kindergartenId)
    if (!state) throw new NotFoundException('Учреждение не найдено')
    return FEATURE_KEYS.map((key) => {
      const def = FEATURES[key]
      const override = state.overrides.get(key)
      return {
        key,
        label: def.label,
        description: def.description,
        group: def.group,
        defaultEnabled: def.defaultEnabled,
        enabled: resolveFeature(key, override),
        overridden: override !== undefined,
      }
    })
  }

  /**
   * Применить изменения: key → true/false (явное значение) или null
   * (сбросить на значение по умолчанию). Всё или ничего.
   */
  async setOverrides(
    kindergartenId: string,
    changes: Record<string, boolean | null>,
  ): Promise<FeatureView[]> {
    const state = await this.loadState(kindergartenId)
    if (!state) throw new NotFoundException('Учреждение не найдено')

    const entries = Object.entries(changes ?? {})
    for (const [key, value] of entries) {
      if (!isFeatureKey(key)) {
        throw new BadRequestException(`Неизвестный раздел: ${key}`)
      }
      if (value !== null && typeof value !== 'boolean') {
        throw new BadRequestException(`Раздел ${key}: ожидается true, false или null`)
      }
    }

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        value === null
          ? this.prisma.kindergartenFeature.deleteMany({ where: { kindergartenId, key } })
          : this.prisma.kindergartenFeature.upsert({
              where: { kindergartenId_key: { kindergartenId, key } },
              create: { kindergartenId, key, enabled: value },
              update: { enabled: value },
            }),
      ),
    )

    this.cache.delete(kindergartenId)
    return this.listForSchool(kindergartenId)
  }

  // ─── кэш ────────────────────────────────────────────────────────

  private async getState(kindergartenId: string): Promise<SchoolState | null> {
    const hit = this.cache.get(kindergartenId)
    if (hit && hit.expires > Date.now()) return hit.state
    const state = await this.loadState(kindergartenId)
    if (state) {
      this.cache.set(kindergartenId, { state, expires: Date.now() + CACHE_TTL_MS })
    }
    return state
  }

  private async loadState(kindergartenId: string): Promise<SchoolState | null> {
    const kg = await this.prisma.kindergarten.findUnique({
      where: { id: kindergartenId },
      select: { features: { select: { key: true, enabled: true } } },
    })
    if (!kg) return null
    return { overrides: new Map(kg.features.map((f) => [f.key, f.enabled])) }
  }
}
