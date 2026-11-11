import { Logger } from '@nestjs/common'
import type { HealthCheckService } from '@nestjs/terminus'

import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { RedisService } from '../../infrastructure/redis/redis.service'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  let queryRaw: jest.Mock
  let ping: jest.Mock
  let controller: HealthController

  // Настоящий HealthCheckService не нужен: достаточно прогнать переданные проверки и собрать результат.
  const health = {
    check: async (checks: Array<() => Promise<Record<string, unknown>>>) => {
      const info: Record<string, unknown> = {}
      for (const c of checks) Object.assign(info, await c())
      return { status: 'ok', info }
    },
  } as unknown as HealthCheckService

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    queryRaw = jest.fn()
    ping = jest.fn().mockResolvedValue('PONG')
    controller = new HealthController(
      health,
      { $queryRaw: queryRaw } as unknown as PrismaService,
      { client: { ping } } as unknown as RedisService,
    )
  })

  it('liveness не трогает базу и Redis', () => {
    const res = controller.liveness()
    expect(res.ok).toBe(true)
    expect(typeof res.uptimeSec).toBe('number')
    expect(queryRaw).not.toHaveBeenCalled()
    expect(ping).not.toHaveBeenCalled()
  })

  it('readiness: база, Redis и миграции в порядке', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]).mockResolvedValueOnce([{ applied: 45, failed: 0 }])
    const res = (await controller.readiness()) as unknown as { info: Record<string, { status: string; applied?: number }> }
    expect(res.info.db.status).toBe('up')
    expect(res.info.redis.status).toBe('up')
    expect(res.info.migrations).toEqual({ status: 'up', applied: 45 })
  })

  it('readiness: незавершённая миграция — сервер не готов (внешний монитор получит ошибку)', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]).mockResolvedValueOnce([{ applied: 40, failed: 1 }])
    await expect(controller.readiness()).rejects.toMatchObject({ causes: { migrations: { status: 'down' } } })
  })

  it('readiness: если таблицы миграций нет, сервер не считается упавшим', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]).mockRejectedValueOnce(new Error('relation "_prisma_migrations" does not exist'))
    const res = (await controller.readiness()) as unknown as { info: Record<string, { status: string; applied: number | null }> }
    expect(res.info.migrations).toEqual({ status: 'up', applied: null })
  })

  it('readiness: недоступный Redis — 503-ошибка с пометкой redis: down, без текста причины', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }])
    ping.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:6379'))
    const err = await controller.readiness().catch((e) => e)
    expect(err.causes).toEqual({ redis: { status: 'down' } })
    expect(JSON.stringify(err.causes)).not.toContain('10.0.0.5')
  })

  it('readiness: недоступная база — ошибка', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection refused'))
    await expect(controller.readiness()).rejects.toMatchObject({ causes: { db: { status: 'down' } } })
  })
})
