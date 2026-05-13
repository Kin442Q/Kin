import { Global, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'

/**
 * Регистрируем BullMQ и список бизнес-очередей.
 * Имена очередей экспортируем как константы (см. ниже),
 * чтобы избежать опечаток.
 */
export const QUEUE_TELEGRAM = 'telegram'
export const QUEUE_PAYMENT_REMINDER = 'payment-reminder'
export const QUEUE_MONTHLY_REPORT = 'monthly-report'
export const QUEUE_AUDIT_LOG = 'audit-log'

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 1000, age: 24 * 3600 },
          removeOnFail: { count: 5000 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_TELEGRAM },
      { name: QUEUE_PAYMENT_REMINDER },
      { name: QUEUE_MONTHLY_REPORT },
      { name: QUEUE_AUDIT_LOG },
    ),
  ],
  exports: [BullModule],
})
export class BullInfraModule {}
