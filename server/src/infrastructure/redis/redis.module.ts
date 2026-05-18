import { Global, Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { REDIS_CLIENT, RedisService } from './redis.service'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis')
        const client = new Redis({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          lazyConnect: false,
          // Если Redis недоступен — не крашим каждую команду.
          // null означает «команды будут ждать восстановления, а не падать после N попыток».
          maxRetriesPerRequest: null,
          // Если очередь оффлайн-команд переполнится — пусть отбрасывает, не зависает.
          enableOfflineQueue: false,
          retryStrategy: (times) => Math.min(times * 200, 5000),
        })
        client.on('error', (err) => {
          // Лог один раз на состояние, без стэка чтобы не засирать вывод
          logger.warn(`Redis unavailable: ${err.message}`)
        })
        return client
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
