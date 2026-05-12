# 🌸 KinderCRM — система управления детским садом

Современная **CRM/ERP** система для детского сада в стиле Linear / Stripe / Vercel.
Premium SaaS-дизайн, **полностью на Ant Design** + анимации Framer Motion,
glassmorphism, light/dark тема, ролевой доступ и полноценная финансовая аналитика.

> Версия 2.0 · 2026 · Full-stack: React + Express + Prisma + PostgreSQL.

---

## ✨ Что внутри

### Возможности

- 📊 **Дашборд** — KPI, доход/расход за 6 мес., структура дохода и расходов, топ групп
- 👶 **Дети** — полная карточка ребёнка (имя, возраст, пол, фото, мед.инфо, родители, Telegram/WhatsApp)
- 🧩 **Группы** — создание/редактирование, статистика по каждой:
  - количество детей, оплативших, должников
  - доход группы, расходы группы (с долей общих расходов)
  - чистая прибыль, маржа, посещаемость
  - **диаграмма выгодности**: какая группа прибыльная, какая убыточная
- 🧮 **Финансы**
  - доходы: оплата родителей, доп. занятия и услуги
  - расходы: зарплата, налоги, аренда, коммунальные, питание, игрушки, канцелярия, интернет, ремонт, прочее
- 📈 **Аналитика** (`/admin/analytics`)
  - Monthly revenue / expenses, Profit / Loss chart, Cash flow, ROI
  - Авто-вывод: компания прибыльная / убыточная, прибыль растёт / падает
  - Рейтинг лучших и худших групп
- ✅ **Посещаемость** — отметка по дням, статусы present / absent / sick / vacation
- 💰 **Оплата** — статус по каждому ребёнку, фильтры, способ оплаты
- 👨‍🏫 **Сотрудники** — позиции, ФОТ
- 📅 **Расписание** и 🍽️ **Меню питания**
- 🔔 **Уведомления** real-time (Socket.io)
- ⚙️ **Настройки** + переключатель темы

### Роли

| Роль | Доступ |
| ---- | ------ |
| **Super Admin / Admin** | Всё: финансы, аналитика, все группы, расходы, сотрудники, настройки |
| **Teacher** | Только своя группа: дети, посещаемость, оплата своей группы, расписание |
| **Parent** | Ребёнок, посещаемость, оплата, расписание, чат |

### Стек

**Frontend**

- React 18 + Vite + TypeScript
- Ant Design 5 + Ant Design Charts + Ant Design Icons
- Framer Motion (page transitions, animated cards, hover effects, smooth fades)
- Tailwind CSS (только utility/layout)
- Zustand (state) + persist в localStorage
- React Router DOM 6
- TanStack React Query, Axios (API-слой)
- dayjs (локаль `ru`)

**Backend**

- Node.js + Express
- Prisma ORM + PostgreSQL
- JWT-аутентификация (bcrypt)
- Socket.io (real-time)
- Zod-валидация
- helmet / cors / morgan

---

## 🗂️ Структура проекта

```
.
├── src/                       # Frontend
│   ├── api/                   # axios + сервисы
│   ├── components/
│   │   ├── auth/              # RequireAuth, RequireRole
│   │   ├── layout/            # AppLayout, AppSidebar, AppHeader
│   │   └── ui/                # переиспользуемые UI (StatCard и т.д.)
│   ├── lib/                   # форматтеры, финансовая логика
│   ├── pages/                 # Dashboard, Groups, GroupDetail, Children,
│   │                          # Payments, Expenses, Analytics, Staff,
│   │                          # Schedule, Menu, Settings, Login, NotFound
│   ├── store/                 # zustand: auth, data, theme
│   ├── theme/                 # ConfigProvider тема antd
│   ├── types.ts               # доменные типы
│   ├── App.tsx                # роутер + protected routes
│   └── main.tsx               # ConfigProvider antd + react-query
│
├── server/                    # Backend
│   ├── prisma/
│   │   ├── schema.prisma      # Prisma schema
│   │   └── seed.ts            # Database seed
│   ├── src/
│   │   ├── middleware/        # auth, error
│   │   ├── routes/            # auth, groups, children, staff, attendance,
│   │   │                      # payments, expenses, analytics, notifications
│   │   ├── db.ts              # Prisma client
│   │   └── index.ts           # Express + Socket.io
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml         # Postgres + backend + frontend
├── Dockerfile                 # Frontend
├── .env.example
└── README.md
```

---

## 🚀 Быстрый старт

### Вариант 1 — только фронт (демо без backend)

```bash
npm install
npm run dev
```

Откройте http://localhost:5173. Логин — любой preset со страницы входа
(`super@kg.app`, `admin@kg.app`, `teacher@kg.app`, `parent@kg.app`, пароль `demo`).
Данные генерируются и хранятся локально в браузере.

### Вариант 2 — полный стек через Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API:      http://localhost:4000/api/health
- Postgres: localhost:5432 (user/pass/db: `kg_user / kg_pass / kg_db`)

### Вариант 3 — локально, без Docker

**Backend**

```bash
cd server
cp .env.example .env       # заполните DATABASE_URL и JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev                # http://localhost:4000
```

**Frontend**

```bash
cp .env.example .env       # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                # http://localhost:5173
```

---

## 🎨 Дизайн-система

- **Premium SaaS** — Linear / Stripe / Notion / Vercel
- **Glassmorphism**, soft shadows, blur effects, gradient backgrounds
- **Light / Dark** — переключатель в шапке, сохраняется в localStorage
- **Framer Motion** — page transitions, animated sidebar, hover, fade, slide,
  skeleton loading, animated cards, scroll animations, modal animations
- **Цвет акцента** — `#6366f1` (indigo). Меняется в `src/theme/antdTheme.ts`

---

## 🧮 Как считается финансовая прибыль группы

Логика лежит в `src/lib/finance.ts` и зеркалируется на бэке.

```
Доход группы  = (сумма paid Payment за месяц по детям группы)
                + (extraIncome.groupId == group.id за этот месяц)

Расход группы = (Expense.groupId == group.id за этот месяц)
                + (Доля общих Expense, без groupId, пропорционально
                   количеству детей в группе от общего числа детей)
                + group.fixedMonthlyExpense

Прибыль       = Доход - Расход
Маржа         = Прибыль / Доход
```

Если **Прибыль ≥ 0** — группа считается **выгодной**, иначе — **убыточной**.
На страницах **Groups** и **GroupDetail** это показано столбчатыми диаграммами
и тегом «Выгодная / Убыточная».

---

## 🔐 Безопасность

- Пароли хешируются `bcryptjs`
- Токен JWT (по умолчанию 7 дней) — передаётся в `Authorization: Bearer …`
- Middleware `requireRole(...)` ограничивает CRUD-эндпоинты ролями
- helmet и cors на бэке
- Zod-валидация всех POST/PUT тел

---

## 🧪 Тестовые учётки (после seed)

| Email | Пароль | Роль |
| ----- | ------ | ---- |
| super@kg.app | demo | SUPER_ADMIN |
| admin@kg.app | demo | ADMIN |

В демо-режиме без бэка просто нажмите любую кнопку быстрого входа.

---

## 📜 Лицензия

MIT.
