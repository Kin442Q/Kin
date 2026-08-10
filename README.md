# 🌸 KinderCRM

Мульти-тенантная **SaaS-платформа управления детскими садами и школами**: веб-кабинет,
мобильное приложение и backend. Один продукт обслуживает много учреждений; каждое работает
в режиме **детского сада** или **школы**, и интерфейс адаптируется под выбранный тип.
> Full-stack: **React + Vite** (web) · **Expo / React Native** (mobile) · **NestJS + Prisma + PostgreSQL** (backend).

---

## ✨ Возможности

### Общее
- 🏫 **Тип учреждения** — детский сад или школа. Задаётся при создании владельцем платформы и **неизменяем**; от него зависят разделы и термины («группа» ↔ «класс»).
- 📊 **Дашборд и аналитика** — доходы/расходы, прибыль по группам/классам, посещаемость, человекочитаемые выводы.
- 👶 **Дети / ученики** — карточка, родители, телефоны (по умолчанию `+992`), мед.инфо.
- 🧩 **Группы / классы**, 👨‍🏫 **сотрудники** и ФОТ, 📅 **расписание**, 🍽️ **меню**.
- ✅ **Посещаемость** + 💰 **оплата** (статусы, способы, долги).
- 💬 **Чат** родитель ↔ сотрудник с разделением каналов (см. ниже).
- 🔔 **Уведомления**: realtime (Socket.io), **push** (Expo) и **Telegram-бот**.

### Режим школы
- 📚 **Предметы**, ✍️ **оценки** (электронный журнал), 📝 **домашние задания**.
- 🗓️ **Учебные четверти/триместры/семестры** (academic terms).
- 📖 **Электронный дневник** (учитель ведёт, родитель видит).

### Мобильное приложение (Expo)
- Кабинеты родителя и учителя, журнал оценок с большой клавиатурой ввода.
- 📍 **Геозоны и чек-ин** с картой + аудит отметок.
- Биометрический вход, push-уведомления.

### Чат — разделение каналов
Учитель **не видит финансы**. Реализованы два независимых канала:
- **GENERAL** — родитель ↔ учитель (общение по ребёнку).
- **ADMIN** — родитель ↔ администрация (финансы/оплата). Напоминания об оплате
  отправляет **только админ**; учителю этот канал недоступен ни в списке, ни по прямой ссылке.

Сообщения доставляются мгновенно через Socket.io, дублируются в Telegram-бот и push.

### Роли
| Роль | Доступ |
| ---- | ------ |
| **SUPER_ADMIN** (владелец платформы) | Создание учреждений, задание типа, полный доступ |
| **ADMIN** | Всё внутри своего учреждения: финансы, аналитика, все группы/классы, чат (оба канала) |
| **TEACHER** | Своя группа/класс: дети, посещаемость, оценки, расписание, чат (только GENERAL) |
| **PARENT** | Свой ребёнок: посещаемость, оплата, оценки, дневник, чат |

---

## 🧱 Стек

**Web** (`/src`)
- React 18 · Vite 5 · TypeScript
- Ant Design 5 · Framer Motion · Tailwind (utility)
- Zustand · React Router 6 · Axios
- Leaflet / react-leaflet (карты) · socket.io-client

**Mobile** (`/mobile`)
- Expo SDK 54 · React Native 0.81 · React Navigation
- Zustand · AsyncStorage · Axios · socket.io-client
- expo-location / -notifications / -device / -local-authentication

**Backend** (`/server`)
- NestJS 10 · Prisma 5 · PostgreSQL
- Redis + BullMQ (очереди: Telegram, отчёты)
- JWT (access + refresh) · class-validator · Swagger
- Socket.io (WebSocket gateway) · Telegram Bot API

**Деплой**
- Backend + Postgres → **Railway** (Docker, миграции при старте контейнера)
- Frontend → **GitHub Pages** (GitHub Actions), base `/Kin/`
- Mobile → Expo / EAS Build

---

## 🗂️ Структура

```
.
├── src/                  # Web (React)
│   ├── api/              # axios-клиент + сервисы (chatApi, parentApi, ...)
│   ├── components/       # sprout UI, layout, auth-гарды
│   ├── hooks/            # useTenantSync и пр.
│   ├── lib/              # форматтеры, socket-клиент
│   ├── pages/            # Dashboard, Payments, Chat, Grades, Terms, parent/*
│   └── store/            # zustand: auth, data, theme
│
├── mobile/               # Expo / React Native (см. mobile/AGENTS.md)
│   └── src/{screens,api,components,lib,store,theme}
│
├── server/               # NestJS
│   ├── prisma/           # schema.prisma + migrations + seed
│   └── src/
│       ├── modules/      # auth, chat, payments, telegram, school, terms, ...
│       ├── infrastructure/  # prisma, bullmq, redis
│       └── common/       # guards, decorators, types
│
└── README.md
```

---

## 🚀 Локальный запуск

### Backend
```bash
cd server
св         # DATABASE_URL, JWT-секреты, REDIS_URL, TELEGRAM_BOT_TOKEN
npm install
npx prisma generate
npx prisma migrate dev
npm run seed                  # тестовые данные
npm run start:dev             # http://localhost:4000 (Swagger: /docs)
```
Нужны запущенные **PostgreSQL** и **Redis** (или `docker compose up`).

### Web
```bash
cp .env.example .env          # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                   # http://localhost:5173
```

### Mobile
```bash
cd mobile
npm install
npx expo start                # Expo Go / dev build
```
> ⚠️ Пакеты ставить только через `npx expo install <pkg>` — версии должны соответствовать SDK 54.

---

## 🧪 Тесты

| Что | Команда | Стек |
| --- | ------- | ---- |
| Backend | `cd server && npm test` | Jest + @nestjs/testing |
| Web | `npm test` | Vitest + Testing Library |

Покрыты, в т.ч.: разделение каналов чата и доступ ролей, напоминания об оплате
(только админ), контракт `chatApi` (scope/endpoints), финансовая логика, гварды.

---

## 🚢 Деплой

- **Backend (Railway):** автодеплой при push в `main`. Образ собирается по `server/Dockerfile`;
  при старте контейнер выполняет `prisma migrate deploy && node dist/main.js`.
  ⚠️ `server/package-lock.json` обязан быть в синхроне с `package.json` — иначе `npm ci` валит сборку.
- **Frontend (GitHub Pages):** GitHub Actions собирает Vite (`base=/Kin/`) и публикует.
- `.npmrc` (`legacy-peer-deps=true`) есть и в корне, и в `server/` — нужен в обоих,
  т.к. docker-контекст backend не видит корневой.

---

## 🔐 Безопасность
- Пароли — bcrypt; доступ — JWT access + refresh, на мобилке авто-разлогин по 401.
- `RolesGuard` + `@Roles(...)` на эндпоинтах; мульти-тенантность по `kindergartenId`.
- Никогда не коммить реальные токены/строки подключения. `.env` — вне git.

---

## 📜 Лицензия
Proprietary. Все права принадлежат владельцу проекта.
