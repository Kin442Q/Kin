# KinderCRM Backend (NestJS)

Production-ready бэкенд CRM/ERP детского сада.

> **Стек:** NestJS 10, TypeScript, PostgreSQL 16, Prisma 5, Redis 7,
> BullMQ, JWT (access + refresh), Swagger, Docker.
> **Архитектура:** см. [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Быстрый старт

### Через Docker (рекомендуется)

Из корня проекта:

```bash
docker compose up --build
```

После старта:
- **API**: http://localhost:4000/api/v1
- **Swagger**: http://localhost:4000/api/docs
- **Postgres**: `localhost:5432` (`kg_user / kg_pass / kg_db`)
- **Redis**: `localhost:6379`

### Локально

```bash
cd server
cp .env.example .env
# отредактируйте DATABASE_URL и JWT_*

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed           # стартовые пользователи и группы
npm run start:dev      # nest watch
```

Логины после `seed`:

| email | пароль | роль |
|-------|--------|------|
| `super@kg.app` | `demo` | SUPER_ADMIN |
| `admin@kg.app` | `demo` | ADMIN |
| `zarina@kg.app` | `demo` | TEACHER (Солнышко) |

---

## Скрипты

| Скрипт | Что делает |
|--------|-----------|
| `npm run start:dev` | Запуск с hot-reload |
| `npm run build` | Сборка `dist/` |
| `npm start` | Production-старт `node dist/main.js` |
| `npm run prisma:generate` | Сгенерировать клиент |
| `npm run prisma:migrate` | Создать миграцию (dev) |
| `npm run prisma:deploy` | Применить миграции (prod) |
| `npm run seed` | Заполнить демо-данными |
| `npm test` / `npm run test:e2e` | Юнит и e2e тесты |

---

## API в двух словах

Все эндпоинты живут на `/api/v1`.

**Аутентификация:**

- `POST /auth/login` → `{ user, accessToken }` + cookie `refreshToken`
- `POST /auth/refresh` → новая пара (по refresh-cookie)
- `POST /auth/logout` → инвалидирует пару
- `POST /auth/register` (только SUPER_ADMIN)

**RBAC:** access-token несёт `role` и `groupId`. На бэке:
- `RolesGuard` сравнивает с `@Roles(...)`
- `GroupScopeGuard` блокирует TEACHER-а от чужих групп
- Доменные проверки в сервисах (см. `students.service.ts`)

Полное описание методов и DTO — в Swagger.

---

## Best practices, заложенные в код

- helmet, CORS allowlist, cookie-parser
- глобальный `ValidationPipe({ whitelist, transform, forbidNonWhitelisted })`
- `nestjs-pino` логи в JSON (для Loki/Datadog)
- `Throttler` (rate-limit) — глобальный
- `HttpExceptionFilter` + `PrismaExceptionFilter` (P2002 → 409, P2025 → 404)
- access/refresh JWT, refresh **rotation + revoke** через БД
- access-token blacklist в Redis после logout
- BullMQ с idempotent `jobId`, `attempts: 3`, exponential backoff
- `app.enableShutdownHooks()` для graceful shutdown
- Health: `/health/liveness` и `/health/readiness` (проверяет DB + Redis)

---

## Деплой на VPS

```
1. Положить репо: git clone ... && cd ...
2. Заполнить server/.env (или передать env через docker compose --env-file)
3. docker compose up -d --build
4. Поставить Caddy/nginx как reverse-proxy с TLS:
     api.example.com  → :4000
     app.example.com  → :5173
5. cron pg_dump → S3 (пример в ARCHITECTURE.md §13)
```

Полный список production-чеклистов — в [ARCHITECTURE.md §11](./ARCHITECTURE.md#11-производительная-стека-production-best-practices).
