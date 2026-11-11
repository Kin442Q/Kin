import { Controller, Get, Logger } from '@nestjs/common'
import { HealthCheckError, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus'
import { ApiTags } from '@nestjs/swagger'

import { Public } from '../../common/decorators/public.decorator'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { currentCommit, uptimeSeconds } from '../monitoring/build-info'
import { scrubText } from '../monitoring/scrub'

export interface MigrationState {
  applied: number
  /** Миграции, которые начались, но не закончились и не откатаны: база в неконсистентном состоянии. */
  failed: number
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name)

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Сервер жив. Проверку Railway и «пинг» снаружи это не нагружает: ни базы, ни Redis. */
  @Public()
  @Get('liveness')
  liveness() {
    return { ok: true, ts: Date.now(), commit: currentCommit(), uptimeSec: uptimeSeconds() }
  }

  /**
   * Сервер готов работать: база, Redis и миграции. Для внешнего монитора доступности: если что-то не так, ответ 503
   * и в теле видно, что именно (`error.redis.status = down`). Причину пишем только в лог: в тексте ошибок бывают адреса хостов.
   */
  @Public()
  @Get('readiness')
  async readiness() {
    return this.health.check([
      () =>
        this.probe('db', async () => {
          await this.prisma.$queryRaw`SELECT 1`
          return {}
        }),
      () =>
        this.probe('redis', async () => {
          const pong = await this.redis.client.ping()
          if (pong !== 'PONG') throw new Error(`Redis ответил ${String(pong)}`)
          return {}
        }),
      () =>
        this.probe('migrations', async () => {
          const state = await this.migrationState()
          // Без таблицы миграций (база создана не через migrate) не придираемся: это не повод считать сервер упавшим.
          if (state && state.failed > 0) throw new Error(`Миграции базы не завершены: ${state.failed}`)
          return { applied: state?.applied ?? null }
        }),
    ])
  }

  async migrationState(): Promise<MigrationState | null> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ applied: number; failed: number }>>`
        SELECT
          COUNT(*) FILTER (WHERE finished_at IS NOT NULL)::int AS applied,
          COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS failed
        FROM _prisma_migrations`
      return rows[0] ? { applied: Number(rows[0].applied), failed: Number(rows[0].failed) } : null
    } catch {
      return null
    }
  }

  private async probe(key: string, fn: () => Promise<Record<string, unknown>>): Promise<HealthIndicatorResult> {
    try {
      return { [key]: { status: 'up', ...(await fn()) } }
    } catch (e) {
      this.logger.error(`Проверка готовности «${key}» не пройдена: ${scrubText(e instanceof Error ? e.message : String(e), 300)}`)
      throw new HealthCheckError(`${key} check failed`, { [key]: { status: 'down' } })
    }
  }
}
