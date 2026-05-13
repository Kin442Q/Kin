# KinderCRM Backend — Architecture

Production-ready NestJS backend для CRM/ERP системы детского сада.

> Стек: **NestJS 10 · TypeScript · PostgreSQL 16 · Prisma 5 · Redis 7 · BullMQ · JWT (Access+Refresh) · Swagger · Docker**.
> Deploy: **VPS + Docker** (docker-compose, либо k8s-ready).

---

## 1. Бизнес-контекст и роли

CRM управляет детским садом: дети, группы, расписание, посещаемость, оплата
и расходы, аналитика прибыльности. Платформа имеет две роли в MVP:

| Роль | Что может |
|------|-----------|
| `SUPER_ADMIN` | Полный доступ ко всему: финансы, аналитика, все группы, пользователи, настройки. |
| `TEACHER` | Только своя группа: список своих учеников (CRUD внутри группы), отметка посещаемости, своё расписание. |

Архитектура заложена под расширение до 4 ролей (`SUPER_ADMIN`, `ADMIN`, `TEACHER`, `PARENT`) — RBAC уже поддерживает любые роли через декоратор.

---

## 2. Высокоуровневая архитектура

```
┌────────────┐          HTTPS         ┌────────────────────────────┐
│  React +   │ ─────────────────────▶ │  Nginx (TLS, rate-limit)   │
│  Vite SPA  │                        └──────────────┬─────────────┘
└────────────┘                                       │
                                                     ▼
                                       ┌────────────────────────────┐
                                       │      NestJS API gateway    │
                                       │  (REST + Swagger + Guards) │
                                       └──────────────┬─────────────┘
                                                      │
                  ┌───────────────────────────────────┼────────────────────────────┐
                  ▼                                   ▼                            ▼
       ┌────────────────────┐              ┌────────────────────┐         ┌────────────────────┐
       │  PostgreSQL 16     │              │     Redis 7        │         │   BullMQ queues    │
       │  (Prisma client)   │              │  cache · sessions  │◀────────│ (Redis-powered)    │
       │  primary store     │              │  · rate-limit     │         │ telegram, reminders│
       └────────────────────┘              └────────────────────┘         └─────────┬──────────┘
                                                                                    │
                                                                                    ▼
                                                                          ┌────────────────────┐
                                                                          │ Telegram Bot API   │
                                                                          │ Email · SMS        │
                                                                          └────────────────────┘
```

Ключевые принципы:
- **Hexagonal / Clean architecture** внутри каждого модуля: Controller → Service → Repository.
- **Single source of truth — Postgres**. Redis — только кэш и брокер очередей.
- **Stateless API**. Любая нода может обрабатывать любой запрос; сессии и кэш — в Redis.
- **Idempotent jobs** в BullMQ (с уникальным `jobId`).
- **Глобальные глобальные фильтры/интерсепторы**: `HttpException` → JSON, `LoggingInterceptor`, `TransformInterceptor`.
- **Observability**: pino-логи в stdout (для Loki/Datadog), Prometheus metrics endpoint, health checks.

---

## 3. Структура папок

```
server/
├─ prisma/
│  ├─ schema.prisma            # Все модели и enum-ы
│  ├─ seed.ts                  # Стартовые пользователи, группы, демо-данные
│  └─ migrations/              # SQL-миграции (создаются prisma migrate dev)
│
├─ src/
│  ├─ main.ts                  # Bootstrap: Swagger, helmet, validation, CORS
│  ├─ app.module.ts            # Корневой модуль
│  ├─ config/                  # @nestjs/config + Joi validation
│  │  ├─ configuration.ts
│  │  └─ validation.ts
│  │
│  ├─ common/                  # Cross-cutting (не зависит от модулей)
│  │  ├─ decorators/           # @CurrentUser, @Roles, @Public, @ApiPaginated
│  │  ├─ filters/              # HttpExceptionFilter, PrismaExceptionFilter
│  │  ├─ guards/               # JwtAuthGuard, RolesGuard, GroupScopeGuard, ThrottlerGuard
│  │  ├─ interceptors/         # LoggingInterceptor, TransformInterceptor, CacheInterceptor
│  │  ├─ pipes/                # ValidationPipe (global), ParseObjectIdPipe
│  │  ├─ types/                # Shared TS types (JwtPayload, AuthUser, …)
│  │  └─ utils/                # date, money, paging helpers
│  │
│  ├─ infrastructure/          # Внешние системы как Nest-модули
│  │  ├─ prisma/
│  │  │  ├─ prisma.module.ts
│  │  │  └─ prisma.service.ts  # extends PrismaClient + onModuleInit
│  │  ├─ redis/
│  │  │  ├─ redis.module.ts
│  │  │  └─ redis.service.ts   # cache.get/set/wrap, lock, pub-sub
│  │  ├─ bullmq/
│  │  │  └─ bull.module.ts     # @nestjs/bullmq, регистрация очередей
│  │  └─ telegram/
│  │     ├─ telegram.module.ts
│  │     └─ telegram.service.ts
│  │
│  ├─ modules/                 # Доменные модули (feature-based)
│  │  ├─ auth/                 # Login, refresh, logout, register
│  │  │  ├─ auth.module.ts
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ strategies/        # jwt.strategy, jwt-refresh.strategy, local.strategy
│  │  │  └─ dto/
│  │  │
│  │  ├─ users/                # CRUD пользователей (SUPER_ADMIN)
│  │  ├─ students/             # CRUD учеников
│  │  ├─ teachers/             # CRUD учителей + привязка к группам
│  │  ├─ groups/               # CRUD групп
│  │  ├─ schedule/             # Расписание занятий по группам
│  │  ├─ attendance/           # Daily attendance + статистика
│  │  ├─ finance/              # Income, Expense, Salary, MonthlyReport
│  │  ├─ analytics/            # Dashboard, profitability, charts
│  │  └─ notifications/        # Уведомления, Telegram, payment reminders
│  │
│  └─ jobs/                    # BullMQ workers (Processors)
│     ├─ telegram.processor.ts
│     ├─ payment-reminder.processor.ts
│     └─ monthly-report.processor.ts
│
├─ test/                       # e2e
├─ Dockerfile                  # multi-stage build
├─ docker-compose.yml          # postgres + redis + api (+ optional pgadmin)
├─ tsconfig.json
├─ nest-cli.json
├─ package.json
└─ .env.example
```

**Почему feature-based, а не layered:** в layered (`/controllers`, `/services`, …) сложнее добавить и выпилить feature; здесь модуль — это самодостаточная единица, мы можем легко вынести его в отдельный сервис при росте.

---

## 4. RBAC

### 4.1. Иерархия

```
SUPER_ADMIN  ─── ★ всё
ADMIN        ─── всё, кроме user-management над SUPER_ADMIN
TEACHER      ─── только своя группа
PARENT       ─── только свой ребёнок
```

### 4.2. Механика

1. JWT содержит `sub` (id), `role`, `groupId` (для TEACHER), `childId` (для PARENT).
2. Каждый защищённый эндпоинт декорируется:
   ```ts
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles(Role.SUPER_ADMIN, Role.TEACHER)
   @ApiBearerAuth()
   ```
3. Доменная фильтрация (TEACHER видит только свою группу) выполняется **в сервисе**, не в guard, потому что:
   - условие зависит от параметров запроса (`groupId`, `studentId`),
   - требует обращения к БД (проверить, что `studentId` принадлежит группе teacher-а),
   - проще тестируется юнит-тестом.
4. Для специфических случаев (`/groups/:id/...`) есть `GroupScopeGuard`, который читает `:id` из params, тянет роль из request.user и валидирует доступ.
5. `@CurrentUser()` decorator достаёт user из request.

### 4.3. Пример guard-а

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ])
    if (!required?.length) return true
    const { user } = ctx.switchToHttp().getRequest()
    return required.includes(user.role)
  }
}
```

### 4.4. AuditLog

Каждое мутирующее действие пишется в `AuditLog` (BullMQ-задача `audit.write`) с
`actorId`, `entity`, `entityId`, `action`, `diff` — для compliance и расследований.

---

## 5. JWT-аутентификация

- **Access Token**: JWT, TTL = 15 минут, HS256, payload `{ sub, role, groupId?, childId? }`.
- **Refresh Token**: JWT, TTL = 30 дней, **хранится в БД** (модель `RefreshToken` — userId, jti, hashedToken, expiresAt, revokedAt). Это позволяет:
  - инвалидировать refresh при логауте,
  - принудительно разлогинить пользователя при смене пароля,
  - детектить кражу refresh (rotate-and-revoke).
- При логине возвращаем оба токена (Access — в JSON, Refresh — `httpOnly Secure SameSite=Strict cookie`).
- `/auth/refresh` — отдельный strategy `jwt-refresh`, читает токен из cookie, проверяет, что он не отозван, выпускает новую пару, **ротирует**: старый jti помечает revoked.
- Logout: revoke текущий jti + добавляем access-token в Redis-blacklist на оставшийся TTL.

```
┌────────┐  POST /auth/login        ┌────────┐
│ Client │ ───────────────────────▶ │  API   │
│        │ ◀────────────── 200 ──── │        │  body:    { accessToken }
└────────┘  refreshToken=cookie     └────────┘  Set-Cookie: refreshToken=...
   │
   │   X-Access expires
   ▼
   POST /auth/refresh  (cookie sent)
   ◀── new accessToken + rotated refreshToken cookie
```

---

## 6. Redis-стратегия

| Назначение | Ключ | TTL |
|------------|------|-----|
| Cache финансовых сводок | `finance:summary:{groupId}:{YYYY-MM}` | 60 сек |
| Cache analytics dashboard | `analytics:dashboard:{YYYY-MM}` | 60 сек |
| Список групп пользователя | `user:groups:{userId}` | 5 мин (инвалидация на mutation) |
| JWT blacklist | `jwt:blacklist:{jti}` | до истечения AT |
| Refresh-token blacklist | `rt:blacklist:{jti}` | до истечения RT |
| Rate-limit per IP | `throttle:{ip}:{route}` | 60 сек |
| Distributed lock (отчёты) | `lock:report:{YYYY-MM}` | 30 сек |
| BullMQ очереди | `bull:{queueName}:*` | управляется BullMQ |

Используем helper `cacheWrap<T>(key, ttl, () => loader())`. На любую мутацию данных
(оплата, расход, новая запись посещаемости) — инвалидируем связанные ключи.

---

## 7. BullMQ — очереди и процессоры

| Queue | Триггер | Что делает |
|-------|---------|-----------|
| `telegram` | На событие (новый платёж, отметка ребёнка) | Шлёт сообщение через Telegram Bot API |
| `payment-reminder` | Cron `0 9 1 * *` (1-го числа в 9:00) | Шлёт родителям должников напоминание |
| `monthly-report` | Cron `0 2 1 * *` | Считает прибыль/убыток за прошлый месяц, кладёт в `MonthlyReport` |
| `audit-log` | На любую мутацию | Пишет AuditLog (асинхронно, чтобы не блокировать HTTP) |
| `notification-fanout` | На бизнес-событие | Рассылка через все каналы (push, email, telegram) |

Все процессоры — **idempotent**: используем `jobId` по бизнес-ключу
(`payment-reminder:{userId}:{YYYY-MM}`), повторное создание задачи в BullMQ
с тем же jobId не создаст дубликат.

Failures: `attempts: 3`, `backoff: { type: 'exponential', delay: 5000 }`,
DLQ-pattern — failed jobs остаются в `failed`, мониторим Bull-Board UI.

---

## 8. PostgreSQL: оптимизация и индексы

### 8.1. Индексы (объявлены в schema.prisma через `@@index`)

| Таблица | Индекс | Зачем |
|---------|--------|-------|
| `Student` | `(groupId)` | Список учеников группы |
| `Student` | `(status)` | Фильтрация активных / архивных |
| `Attendance` | `(studentId, date)` UNIQUE | Один статус на день |
| `Attendance` | `(groupId, date)` | Журнал посещаемости группы за день |
| `Payment` | `(studentId, month)` UNIQUE | Один платёж на месяц |
| `Payment` | `(month, paid)` | Должники за месяц |
| `Expense` | `(month, category)` | Аналитика расходов |
| `Expense` | `(groupId, month)` | Расходы группы за месяц |
| `Salary` | `(teacherId, month)` UNIQUE | ЗП за месяц |
| `RefreshToken` | `(jti)` UNIQUE; `(userId)` | Быстрый revoke |
| `AuditLog` | `(actorId, createdAt)` ; `(entity, entityId)` | Поиск истории |

### 8.2. Партиционирование (для роста)

`Attendance` и `AuditLog` при росте > 1М строк партиционируем по месяцу
(`PARTITION BY RANGE (date)`). Prisma не управляет партициями напрямую — делается
через SQL-миграцию.

### 8.3. Запросы

- Все «отчётные» запросы группируются в **транзакции с уровнем `REPEATABLE READ`**, чтобы цифры были консистентными.
- Используем `prisma.$queryRaw` только в `analytics.repository.ts` для тяжёлых агрегаций (SUM, GROUP BY, JOIN-ов 3+).
- Для пагинации — **keyset pagination** (`WHERE id > :cursor ORDER BY id LIMIT :n`), а не OFFSET.

---

## 9. Финансовая логика и прибыльность

### 9.1. Расчёт прибыли группы за месяц

```
income(group, month) =
   Σ payment.amount  WHERE payment.paid AND payment.month = M AND student.groupId = G
 + Σ extra_income.amount WHERE groupId = G AND month = M

expense(group, month) =
   Σ expense.amount      WHERE groupId = G AND month = M             [direct]
 + Σ salary.amount        WHERE teacherId IN teachers_of(G) AND month = M
 + (Σ expense.amount  WHERE groupId IS NULL AND month = M) × studentsInGroup / totalStudents   [shared]

profit(group, month) = income - expense
margin(group, month) = profit / income     (если income > 0)
```

### 9.2. Стратегия выдачи (выбрано: **live + Redis 60 sec**)

```
GET /analytics/group/:id/finance?month=2026-05
  └─ tryFromCache(`finance:group:{id}:{month}`)
       └─ miss → fromDb() (raw SQL aggregation, single round-trip)
            └─ writeCache(60 sec) → return
```

Преимущества: всегда свежие данные при изменениях, простая инвалидация
(`cache.del(...)` в `PaymentsService.update / ExpensesService.update`).
При росте до 100k+ Payment строк — добавляем materialized view
`finance_monthly_mv` и BullMQ job по cron, для прошлых месяцев читаем оттуда.

---

## 10. Конфигурация и секреты

`@nestjs/config` + Joi-валидация. Файл `.env.example`:

```
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://kg_user:kg_pass@db:5432/kg_db?schema=public

REDIS_HOST=redis
REDIS_PORT=6379

JWT_ACCESS_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

CORS_ORIGIN=http://localhost:5173

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

THROTTLE_TTL=60
THROTTLE_LIMIT=120
```

Секреты в проде — через Docker secrets / Kubernetes secrets / Vault.

---

## 11. Производительная стека (production best practices)

1. **HTTP**: helmet, compression, CORS allowlist, body-size limit, `trust proxy`.
2. **Validation**: глобальный `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })`. Не доверяем клиенту.
3. **Throttling**: `@nestjs/throttler` + Redis (распределённый). Жёсткий лимит на `/auth/*`.
4. **Logging**: `nestjs-pino`, JSON в stdout, correlation-id (`x-request-id`) во всех логах и downstream-вызовах.
5. **Errors**: глобальный `HttpExceptionFilter` + `PrismaClientKnownRequestError` (P2002 → 409, P2025 → 404).
6. **Swagger**: `/api/docs` (только если `NODE_ENV !== 'production'` или защищён basic auth).
7. **Health**: `/health/liveness`, `/health/readiness` с проверкой Postgres и Redis.
8. **Migrations**: `prisma migrate deploy` в init-контейнере перед стартом API.
9. **Graceful shutdown**: `app.enableShutdownHooks()` + drain BullMQ workers.
10. **Tests**: jest (unit + e2e), supertest. CI: lint → typecheck → tests → docker build.

---

## 12. Масштабирование

| Что | Как |
|-----|-----|
| Горизонталь | API stateless → запускаем N инстансов за nginx/ALB |
| База | read-replicas для analytics (separate datasource в Prisma) |
| Кэш | Redis Cluster при росте |
| Очереди | BullMQ workers — отдельные процессы (`npm run worker`), масштабируются независимо от API |
| Файлы (фото) | S3-совместимое хранилище (минио для on-prem) |
| Логи / метрики | Loki + Grafana, либо Datadog |

API не держит in-memory состояние, любая нода взаимозаменяема. Балансировщик —
sticky session НЕ нужен.

---

## 13. Deploy на VPS

1. На VPS: docker, docker-compose, nginx (или Caddy для авто-TLS).
2. CI/CD: GitHub Actions → `docker build` → push в registry → `ssh vps && docker compose pull && docker compose up -d` (или Watchtower).
3. Caddy reverse-proxy, авто Let's Encrypt:
   ```
   api.kindercrm.tj {
     reverse_proxy localhost:4000
   }
   ```
4. Бэкапы: `pg_dump` в cron, ротация в S3.

---

## 14. Что заскаффолжено в этом коммите

| Модуль | Состояние |
|--------|-----------|
| Prisma schema | ✅ полная |
| AppModule, main.ts, config | ✅ |
| PrismaModule, RedisModule, BullModule | ✅ |
| AuthModule + JWT strategies | ✅ |
| RolesGuard + GroupScopeGuard + декораторы | ✅ |
| Students, Groups, Attendance | ✅ контроллер + сервис + DTO |
| Finance / Analytics / Notifications | 🟡 каркас + примеры эндпоинтов |
| Telegram processor | 🟡 каркас |
| Docker + compose | ✅ |
| Swagger | ✅ |

Остальное — наращивается по той же схеме (Controller → Service → DTO → Repository → Tests).
