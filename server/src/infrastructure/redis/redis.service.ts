import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

/**
 * Высокоуровневый wrapper над ioredis.
 *
 * Чем удобен:
 *   await redis.wrap(key, 60, () => loadHeavyData())
 *   — атомарная "проверь кэш / загрузи / положи" обёртка.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)

  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  private safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    return fn().catch((e) => {
      this.logger.debug?.(`Redis op failed (degraded): ${(e as Error).message}`)
      return fallback
    })
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.safe(async () => {
      const raw = await this.client.get(key)
      return raw ? (JSON.parse(raw) as T) : null
    }, null)
  }

  async set(key: string, value: unknown, ttlSec?: number): Promise<void> {
    await this.safe(async () => {
      const payload = JSON.stringify(value)
      if (ttlSec) {
        await this.client.set(key, payload, 'EX', ttlSec)
      } else {
        await this.client.set(key, payload)
      }
    }, undefined)
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return
    await this.safe(async () => {
      await this.client.del(...keys)
    }, undefined)
  }

  async delByPattern(pattern: string): Promise<void> {
    await this.safe(async () => {
      const stream = this.client.scanStream({ match: pattern, count: 200 })
      for await (const keys of stream as AsyncIterable<string[]>) {
        if (keys.length) await this.client.del(...keys)
      }
    }, undefined)
  }

  /**
   * Cache-aside: возвращает кэш, либо вычисляет и кладёт под ttl.
   * Если Redis недоступен — просто вызывает loader без кэширования.
   */
  async wrap<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached
    const value = await loader()
    await this.set(key, value, ttlSec)
    return value
  }

  /** Простой распределённый lock на основе SET NX EX. */
  async withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T | null> {
    const ok = await this.safe(
      () => this.client.set(`lock:${key}`, '1', 'EX', ttlSec, 'NX'),
      null as null | 'OK',
    )
    if (!ok) return null
    try {
      return await fn()
    } finally {
      await this.safe(() => this.client.del(`lock:${key}`), 0)
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit()
    } catch (e) {
      this.logger.warn('Redis quit failed: ' + (e as Error).message)
    }
  }
}
