import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'

import { configuration } from './config/configuration'
import { envValidationSchema } from './config/validation'

import { PrismaModule } from './infrastructure/prisma/prisma.module'
import { RedisModule } from './infrastructure/redis/redis.module'
import { BullInfraModule } from './infrastructure/bullmq/bull.module'

import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { KindergartensModule } from './modules/kindergartens/kindergartens.module'
import { GroupsModule } from './modules/groups/groups.module'
import { StudentsModule } from './modules/students/students.module'
import { TeachersModule } from './modules/teachers/teachers.module'
import { StaffModule } from './modules/staff/staff.module'
import { AttendanceModule } from './modules/attendance/attendance.module'
import { ScheduleModule } from './modules/schedule/schedule.module'
import { FinanceModule } from './modules/finance/finance.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { ExpensesModule } from './modules/expenses/expenses.module'
import { ExtraIncomeModule } from './modules/extra-income/extra-income.module'
import { MenuModule } from './modules/menu/menu.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { HealthModule } from './modules/health/health.module'
import { TelegramModule } from './modules/telegram/telegram.module'
import { MeetingsModule } from './modules/meetings/meetings.module'

import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{
          ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
          limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
        }],
      }),
    }),

    // Инфраструктурные модули — глобальные
    PrismaModule,
    RedisModule,
    BullInfraModule,

    // Доменные модули
    AuthModule,
    UsersModule,
    KindergartensModule,
    GroupsModule,
    StudentsModule,
    TeachersModule,
    StaffModule,
    AttendanceModule,
    ScheduleModule,
    FinanceModule,
    PaymentsModule,
    ExpensesModule,
    ExtraIncomeModule,
    MenuModule,
    AnalyticsModule,
    NotificationsModule,
    HealthModule,
    TelegramModule,
    MeetingsModule,
  ],
  providers: [
    // Глобальный JWT-guard. Эндпоинты с @Public() пропускают его.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Глобальный rate-limiting.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Глобальный логгер запросов.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
