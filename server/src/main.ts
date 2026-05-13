import { NestFactory, Reflector } from '@nestjs/core'
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'

/**
 * Bootstrap NestJS-приложения.
 * Здесь — глобальная инфраструктура: безопасность, CORS, валидация,
 * фильтры/интерсепторы, версия API, Swagger.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService)

  // Логи через nestjs-pino — JSON в stdout, удобно для Loki/Datadog.
  app.useLogger(app.get(Logger))

  // Безопасность HTTP-заголовков
  app.use(helmet())
  app.use(cookieParser())
  app.enableCors({
    origin: config.get<string[]>('corsOrigin'),
    credentials: true,
  })

  // Версионирование: /api/v1/...
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  // Валидация DTO. whitelist гарантирует, что неизвестные поля отрежутся.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Глобальные фильтры исключений
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter())

  // Глобальные интерсепторы
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  )

  // Swagger (только не в проде, либо за basic auth)
  if (config.get<string>('env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('KinderCRM API')
      .setDescription('Backend API детского сада')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const doc = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, doc, {
      swaggerOptions: { persistAuthorization: true },
    })
  }

  app.enableShutdownHooks()

  const port = config.get<number>('port')!
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`✓ KinderCRM API: http://localhost:${port}/api/v1`)
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed', err)
  process.exit(1)
})
