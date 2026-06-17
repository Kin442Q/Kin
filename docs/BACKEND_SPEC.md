# ТЗ: Backend KinderCRM (для переписывания на другом языке)

> Документ описывает **поведение** существующего бэкенда (NestJS + Prisma + PostgreSQL)
> на уровне, достаточном для переписывания на любом языке (Go, Java, C#, Python, Kotlin…)
> с сохранением полной совместимости с веб- и мобильным клиентами.
>
> Источник истины — код в `server/`. Здесь зафиксированы контракты, модель данных,
> правила доступа и бизнес-логика. Где есть нетривиальные формулы — они приведены дословно.

---

## 1. Обзор

KinderCRM — **мульти-тенантная SaaS** для детских садов и школ. Один экземпляр обслуживает
много учреждений (`Kindergarten`), каждое работает в режиме **сад** (`KINDERGARTEN`) или
**школа** (`SCHOOL`). Тип задаётся при создании и почти неизменяем; от него зависят доступные
фичи (предметы/оценки/ДЗ/четверти — только школа) и термины в UI («группа»↔«класс»).

Клиенты: веб (React), мобильный (Expo/React Native). Связь — REST + WebSocket (Socket.io).
Внешние интеграции: **Telegram-бот** (уведомления родителям), **Expo Push**, **webhook от
терминала контроля доступа** (Hikvision/ZKTeco).

### Технологический стек оригинала (что нужно заменить эквивалентами)

| Слой | Оригинал | Что важно сохранить |
|------|----------|---------------------|
| HTTP-фреймворк | NestJS 10 (Express) | REST, префикс `/api`, версия `/v1` |
| ORM/БД | Prisma 5 + PostgreSQL 16 | схему данных 1:1 (см. §6) |
| Аутентификация | JWT (access+refresh) + passport-jwt + bcrypt | алгоритмы и формат токенов (§4) |
| Кэш/локи | Redis (ioredis) | cache-aside 60с для финансов/аналитики (§14) |
| Очереди | BullMQ (Redis) | очередь `telegram`, воркер (§11) |
| Realtime | Socket.io | имена событий и комнат (§10) |
| Валидация | class-validator / ValidationPipe | те же правила полей (§7, §8) |
| Документация | Swagger (`/api/docs`) | желательно сохранить |
| Логи | pino (JSON) | любой структурный логгер |

> ⚠️ В `server/src/routes/*`, `server/src/index.ts`, `server/src/db.ts`,
> `server/src/middleware/*` лежит **legacy Express-прототип**, который НЕ подключён к рабочему
> приложению (точка входа — `src/main.ts` → `AppModule`). При переписывании ориентироваться
> только на NestJS-модули (`src/modules/*`).

---

## 2. Глобальные конвенции HTTP

- **Базовый префикс:** все маршруты начинаются с `/api`, версия в URI — `v1`.
  Полный путь: `/api/v1/<...>`. (Фронтенд использует `baseURL = <host>/api`, поэтому в его
  коде пути выглядят как `/v1/...`.)
- **Формат успешного ответа (envelope):** глобальный интерсептор оборачивает любой результат
  контроллера в `{ "data": <payload> }`. Исключение: если контроллер уже вернул объект,
  содержащий ключ `data` или `meta`, он отдаётся как есть. → **Реализовать тот же конверт.**
- **Формат ошибки (HttpException):**
  ```json
  { "statusCode": 400, "path": "/api/v1/...", "timestamp": "ISO-8601", "message": "текст" }
  ```
  `message` — строка; если оригинал — массив (ошибки валидации), он склеивается через `, `.
- **Формат ошибки БД (нарушение ограничений):**
  ```json
  { "statusCode": 409, "code": "P2002", "message": "...", "meta": {...}, "timestamp": "ISO" }
  ```
  Маппинг: unique-конфликт → `409`, не найдено → `404`, нарушение FK → `409`, иначе → `400`.
- **Аутентификация:** заголовок `Authorization: Bearer <accessToken>`. Refresh-токен — в
  httpOnly cookie `refreshToken` (см. §4).
- **Валидация тела:** whitelist + forbidNonWhitelisted (неизвестные поля → 400), неявная
  конвертация типов включена. Все DTO-правила из §8 обязательны.
- **CORS:** `credentials: true`. Разрешённые origin: список из `CORS_ORIGIN` (через запятую)
  + автоматически `localhost`/`127.0.0.1` (любой порт), `*.netlify.app`, `*.up.railway.app`,
  `*.github.io`, `*.pages.dev`. Запросы без `Origin` (curl/Postman) разрешены.
- **Security headers:** аналог helmet.
- **Rate limiting (throttling):** глобально `THROTTLE_LIMIT` запросов за `THROTTLE_TTL` секунд
  (по умолчанию 120 / 60с).
- **Healthcheck (Public):** `GET /api/v1/health/liveness` → `{ ok, ts }`;
  `GET /api/v1/health/readiness` → проверка БД (`SELECT 1`) и Redis (`PING`).
- **Деньги:** в БД `Decimal(12,2)`; клиенту отдаются как `number`. Все суммы в ответах
  финансов/аналитики **округляются** `Math.round` (до целых).
- **Даты-«календарные» (`@db.Date`):** хранятся как полночь UTC соответствующей даты
  (`new Date("YYYY-MM-DD")`). Для точного match по дню использовать UTC-полночь, НЕ локальную
  (есть баг-история с TZ Asia/Dushanbe). Строка месяца — формат `YYYY-MM`.
- **ID:** строковые `cuid()` (генерировать collision-resistant ID; формат не критичен для
  клиента, но должен быть строкой).

---

## 3. Архитектура мульти-тенантности

- У большинства сущностей есть `kindergartenId` (nullable). Пользователь несёт `kindergartenId`
  в JWT.
- **Правило фильтрации:** если у пользователя есть `kindergartenId`, любые list/get/mutate
  ограничиваются этим учреждением (`where kindergartenId = user.kindergartenId`). Если
  `kindergartenId === null` — это **глобальный владелец платформы** (SUPER_ADMIN), видит всё.
- При мутациях проверяется, что объект принадлежит учреждению пользователя, иначе `403`.
- TEACHER дополнительно ограничен своими классами (основной `groupId` + many-to-many
  `teachingGroups`) — см. §5 и §9.

---

## 4. Аутентификация и сессии

### Токены
- **Access JWT:** секрет `JWT_ACCESS_SECRET`, TTL `JWT_ACCESS_TTL` (по умолчанию `15m`).
  Payload:
  ```ts
  { sub: userId, email, role, kindergartenId|null, groupId|null, childId|null, jti }
  ```
- **Refresh JWT:** секрет `JWT_REFRESH_SECRET`, TTL `JWT_REFRESH_TTL` (по умолчанию `30d`).
  Payload: `{ sub: userId, jti }`. Передаётся **только** через httpOnly cookie `refreshToken`.

### Cookie refresh-токена
```
name=refreshToken; httpOnly; secure(prod); sameSite=strict; path=/api/v1/auth; expires=<refreshTTL>
```

### Хранение и отзыв
- На каждый выпуск пары создаётся запись `RefreshToken` в БД: `{ jti(unique), tokenHash=sha256(refreshToken), userAgent, ip, expiresAt }`. Сам токен не хранится.
- **Refresh = ротация:** при `/auth/refresh` проверяется, что запись существует, не отозвана и
  не истекла, и `sha256(raw) === tokenHash`. Старый jti помечается `revokedAt`, выдаётся новая
  пара. **Защита от повторного использования:** если пришёл валидный по подписи, но уже
  отозванный/неизвестный refresh — отзываются ВСЕ refresh-токены пользователя (подозрение на
  кражу) и возвращается `401`.
- **Logout:** отзывает refresh по jti (если есть cookie) и кладёт **access jti в Redis-blacklist**
  на 15 минут (TTL access). Ключ: `jwt:blacklist:<jti>`. Возвращает `204`, чистит cookie.
- **Проверка access:** на каждый запрос JWT-стратегия дополнительно проверяет, что
  `jwt:blacklist:<jti>` отсутствует в Redis; иначе `401` («Токен отозван»).

### Пароли
- bcrypt, cost = 10. Хранится `passwordHash`.

### Эндпоинты auth (`/api/v1/auth`)
| Метод | Путь | Доступ | Тело / поведение |
|------|------|--------|------------------|
| POST | `/login` | Public | `{ email? , phone?, password }` (нужен email **или** phone). Логин по email (lowercased+trim) или по phone (trim). Неактивный пользователь → 401. Возвращает `{ user, accessToken }` + ставит refresh-cookie. Обновляет `lastLoginAt`. HTTP 200. |
| POST | `/refresh` | Public (cookie) | Ротация (см. выше). Возвращает `{ accessToken, user }` + новый cookie. 200. |
| POST | `/logout` | Auth | Отзыв (см. выше). 204. |
| GET | `/me` | Auth | `{ ...user, institution }`, где institution = `{ id, name, type, latitude, longitude, checkInRadiusMeters }` или null. |
| POST | `/register` | SUPER_ADMIN | `RegisterDto` (см. §8). Нельзя создать SUPER_ADMIN не будучи им. Email уникален. |

Сериализация пользователя (везде, где возвращается «user»):
`{ id, email, fullName, role, kindergartenId, groupId, childId, avatarUrl, phone }`.

---

## 5. Роли и доступ

Роли (`Role`): `SUPER_ADMIN`, `ADMIN`, `TEACHER`, `PARENT`.

- **Глобальный guard аутентификации** применяется ко всем маршрутам, КРОМЕ помеченных «Public».
- **RolesGuard**: если на маршруте заданы роли — пользователь должен иметь одну из них, иначе
  `403`. Если роли не заданы — пропускает всех аутентифицированных.
- **GroupScopeGuard** (используется в `groups/:id`): SUPER_ADMIN/ADMIN — без ограничений;
  TEACHER — только если `user.groupId === <param>` (иначе 403).

Сводная матрица (детали — в §8/§9):

| Роль | Что доступно |
|------|--------------|
| **SUPER_ADMIN** | Если `kindergartenId=null` — владелец платформы (CRUD учреждений). Иначе — полный доступ внутри своего учреждения. |
| **ADMIN** | Всё внутри своего учреждения: финансы, аналитика, сотрудники, посещаемость, оплата, чат (только ADMIN-канал), настройки терминала и т.д. |
| **TEACHER** | Только свои классы (основной `groupId` + `teachingGroups`): ученики, посещаемость, оценки, ДЗ, дневник, расписание (чтение), чат (только GENERAL-канал своих классов), таймтрекинг (свой). |
| **PARENT** | Только свой ребёнок (через `User.childId` или `Student.parents[]`): расписание, посещаемость, оплата, оценки, ДЗ, дневник, чат (оба своих канала). |

«Свои классы учителя» (`teacherGroupIds`) считаются так: `Set(groupId + teachingGroups[].id)`
(пустые отфильтрованы). Если у учителя нет классов — list-эндпоинты возвращают `[]`.

---

## 6. Модель данных (PostgreSQL)

Точная схема — `server/prisma/schema.prisma`. Ниже сжатый, но полный перечень. Все таблицы,
если не сказано иное: `id String @id (cuid)`, `createdAt`, `updatedAt`.

### 6.1 Enums
- `Role`: SUPER_ADMIN, ADMIN, TEACHER, PARENT
- `Gender`: MALE, FEMALE
- `StudentStatus`: ACTIVE, ON_HOLD, ARCHIVED
- `AttendanceStatus`: PRESENT, ABSENT, SICK, VACATION
- `Mood`: HAPPY, NEUTRAL, SAD, SICK
- `NapQuality`: GOOD, NORMAL, POOR, NO_NAP
- `GradeType`: CLASSWORK, HOMEWORK, CONTROL, EXAM, PROJECT, OTHER
- `TermType`: QUARTER, TRIMESTER, SEMESTER
- `PaymentMethod`: CASH, CARD, TRANSFER
- `ExpenseCategory`: SALARIES, TAXES, RENT, UTILITIES, FOOD, TOYS, STATIONERY, INTERNET, CLEANING, REPAIRS, EDUCATION, OTHER
- `StaffPosition`: TEACHER_ASSISTANT, HEAD_MASTER, METHODIST, NURSE, COOK, PSYCHOLOGIST, MUSIC_TEACHER, GUARD, CLEANER, OTHER
- `NotificationChannel`: IN_APP, EMAIL, SMS, TELEGRAM
- `NotificationType`: INFO, SUCCESS, WARNING, ERROR
- `AuditAction`: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, PASSWORD_CHANGE
- `InstitutionType`: KINDERGARTEN, SCHOOL
- `MealType`: BREAKFAST, LUNCH, SNACK, DINNER
- `SalaryMode`: HOURLY, FIXED
- `TimeVerifyMethod`: MANUAL, FACE, PIN, QR, TERMINAL
- `ConversationScope`: GENERAL, ADMIN
- `MessageKind`: TEXT, PAYMENT

### 6.2 Сущности

**Kindergarten** (учреждение / тенант)
- `name`, `slug @unique`, `address?`, `phone?`, `isActive=true`
- `type InstitutionType = KINDERGARTEN`
- `terminalApiKey? @unique` — ключ webhook терминала
- `latitude? Float`, `longitude? Float`, `checkInRadiusMeters Int = 150` — геофенс check-in
- связи: users, groups, students, expenses, extraIncomes, staff, menuItems, subjects, terms

**User**
- `email @unique`, `passwordHash`, `fullName`, `role = TEACHER`, `avatarUrl?`, `phone?`
- `kindergartenId?` (null = глобальный супер-админ)
- `groupId?` — основная группа учителя
- `teachingGroups` — M:N классы учителя (связь «TeacherClasses»)
- `childId?` + `child` — для PARENT (legacy-привязка к одному ребёнку)
- `isActive=true`, `lastLoginAt?`
- Time-tracking: `salaryMode=HOURLY`, `hourlyRate? Decimal(10,2)`, `monthlySalaryFixed? Decimal(12,2)`, `workNorm Int = 176`, `faceDescriptor? Json` (128 float), `terminalCode? @unique`
- `expoPushToken?`
- связи: refreshTokens, auditLogs, notifications, timeEntries, staffProfile, diaryEntries, kidNotes, gradesGiven, homeworkSet, conversations(parent), sentMessages

**RefreshToken**: `userId`, `jti @unique`, `tokenHash`, `userAgent?`, `ip?`, `expiresAt`, `revokedAt?`

**TimeEntry**: `userId`, `date @db.Date`, `checkIn`, `checkOut?`, `minutesWorked? Int`, `verifyMethod=MANUAL`, `note?`, `editedByAdminId?`, `checkInLat? Float`, `checkInLon? Float`, `distanceMeters? Int`

**Group**
- `name`, `ageRange` (для сада), `gradeLabel?` («5А»), `gradeNumber? Int` (параллель)
- `capacity Int = 20`, `monthlyFee Decimal(12,2)=0`, `fixedMonthlyExpense Decimal(12,2)=0`
- `color = "#6366f1"`, `isActive=true`, `kindergartenId?`
- связи: students, teachers(GroupTeachers), teachingTeachers(TeacherClasses), schedule, expenses, extraIncomes, attendance, salaries, monthlyReports, meetings, diary, homework, conversations

**Student**
- `firstName`, `lastName`, `middleName?`, `birthDate DateTime`, `gender`, `photoUrl?`, `medicalNotes?`, `notes?`
- Родители: `motherName?`, `motherPhone?`, `fatherName?`, `fatherPhone?`, `address?`, `extraContact?`, `telegram?`, `whatsapp?`
- `monthlyFee? Decimal(12,2)` (индивидуальная плата; если null — берётся `group.monthlyFee`)
- `status=ACTIVE`, `enrolledAt`, `archivedAt?`
- `groupId` (обязателен), `kindergartenId?`
- связи: attendance, payments, parents(User[]), kidNotes, grades

**ScheduleItem**: `groupId`, `dayOfWeek Int (1..7, Пн..Вс)`, `startTime "HH:mm"`, `endTime`, `activity`, `subjectId?`, `teacherId?`, `room?`

**Attendance**: `studentId`, `groupId` (денормализован), `date @db.Date`, `status`, `note?`, `markedById?`. **Unique:** `(studentId, date)`.

**Payment**: `studentId`, `month "YYYY-MM"`, `amount Decimal(12,2)`, `paid=false`, `paidAt?`, `method?`, `comment?`. **Unique:** `(studentId, month)`.

**ExtraIncome**: `title`, `amount Decimal(12,2)`, `month`, `groupId?`, `comment?`, `kindergartenId?`

**Expense**: `category`, `description`, `amount Decimal(12,2)`, `month`, `groupId?` (null = общий, распределяется пропорционально), `kindergartenId?`

**Salary**: `teacherId`, `groupId?`, `month`, `amount Decimal(12,2)`, `paid=false`, `paidAt?`, `comment?`. **Unique:** `(teacherId, month)`. (В API напрямую не используется — задел.)

**MonthlyReport** (кэш итогов): `groupId`, `month`, `studentsCount`, `paidCount`, `debtorsCount`, `income/expenses/profit Decimal(14,2)`, `margin Decimal(6,4)`, `attendanceRate Decimal(5,4)`, `generatedAt`. **Unique:** `(groupId, month)`.

**Meeting**: `groupId`, `title`, `scheduledAt`, `location?`, `description?`, `createdById?`

**PhoneChatLink** (привязка телефона к Telegram): `phoneNormalized @unique` (последние 9 цифр), `chatId BigInt`, `fullName?`, `username?`

**Notification**: `userId?`, `title`, `description?`, `type=INFO`, `channel=IN_APP`, `read=false`, `payload? Json`

**AuditLog**: `actorId?`, `action`, `entity`, `entityId?`, `diff? Json`, `ip?`, `userAgent?` (задел; в текущих эндпоинтах не пишется массово)

**DiaryEntry** (дневник группы на день): `groupId`, `date @db.Date`, `breakfast?`, `lunch?`, `snack?`, `activities?`, `note?`, `authorId`. **Unique:** `(groupId, date)`.

**KidNote** (заметка о ребёнке на день): `studentId`, `date @db.Date`, `mood?`, `napQuality?`, `note?`, `photoUrls String[]=[]`, `authorId`. **Unique:** `(studentId, date)`.

**Subject** (только школа): `name`, `color="#4FB286"`, `kindergartenId?`. **Unique:** `(kindergartenId, name)`.

**Grade**: `studentId`, `subjectId`, `value Int`, `type=CLASSWORK`, `date @db.Date`, `comment?`, `authorId`.

**Homework**: `subjectId`, `groupId`, `title`, `description?`, `dueDate @db.Date`, `attachments String[]=[]`, `authorId`.

**Term** (учебный период): `name`, `type=QUARTER`, `startDate @db.Date`, `endDate @db.Date`, `kindergartenId?`.

**Conversation** (переписка): `groupId`, `parentId`, `scope=GENERAL`, `kindergartenId?`, `lastMessageAt`, `parentReadAt?`, `staffReadAt?`. **Unique:** `(groupId, parentId, scope)`.

**Message**: `conversationId`, `senderId`, `text`, `kind=TEXT`.

### 6.3 Каскады (важно для FK)
- Удаление `Kindergarten` каскадит users, groups, students, expenses, extraIncomes, staff, menuItems, subjects, terms.
- Удаление `Student`/`Group` каскадит зависимые (attendance, payments, grades, homework, conversations…).
- `Staff.userId` при удалении User → `SetNull`. `User.groupId` при удалении Group → `SetNull`.
- Индексы: см. `@@index` в схеме — воспроизвести для производительности (особенно по
  `kindergartenId`, `month`, `date`, `(groupId,date)`).

---

## 7. Правила валидации (общие)

Все из class-validator; реализовать эквивалентами:
- строки — trim там, где указано в сервисах (имена, названия → trim перед записью);
- `email` — формат email; `phone` — строка (без жёсткого формата, по умолчанию `+992…`);
- даты приходят как ISO-строки (`IsDateString`), на сервере → `new Date(...)`;
- enum-поля валидируются по списку значений;
- числовые границы: оценка `value` 1..10; `dayOfWeek` 1..7; `checkInRadiusMeters` 20..5000;
  `workNorm` ≥1; суммы ≥0; пароль ≥6 символов;
- неизвестные поля в теле → 400 (forbidNonWhitelisted).

---

## 8. REST API — полный перечень эндпоинтов

Везде требуется `Bearer` access-токен, кроме помеченных **Public**. В колонке «Роли» —
требования RolesGuard (пусто = любой аутентифицированный). Все пути — от `/api/v1`.

### auth — см. §4.

### users `/users` (роли по умолчанию: SUPER_ADMIN, ADMIN)
| Метод | Путь | Поведение |
|------|------|-----------|
| GET | `/users` | Список пользователей учреждения. |
| GET | `/users/teachers` | Список учителей учреждения. |
| POST | `/users/teacher` | Создать учителя: `{ fullName, phone, email?, password, groupId? }`. |
| PATCH | `/users/teacher/:id` | `{ fullName?, phone?, email?, password?, groupId?|null, teachingGroupIds?[] }`. |
| DELETE | `/users/teacher/:id` | Удалить учителя. |
| PATCH | `/users/:id/active` | `{ isActive }`. |

### kindergartens `/kindergartens`
| Метод | Путь | Роли | Поведение |
|------|------|------|-----------|
| GET | `/` | SUPER_ADMIN (только глобальный, `kindergartenId=null`) | Список учреждений + `stats{usersCount,groupsCount,studentsCount}`. |
| PATCH | `/mine` | ADMIN, SUPER_ADMIN | Обновить своё учреждение: `{name?,address?,phone?,latitude?,longitude?,checkInRadiusMeters?}`. **`type` игнорируется** (админ не меняет тип). |
| POST | `/` | SUPER_ADMIN (глобальный) | Создать учреждение + первого SUPER_ADMIN атомарно: `{ name, address?, phone?, type?, owner:{fullName,email,password} }`. Генерит уникальный `slug` (транслит кириллицы). |
| PATCH | `/:id` | SUPER_ADMIN (глобальный) | Обновить любое: те же поля + `isActive?`, `type?`. |
| DELETE | `/:id` | SUPER_ADMIN (глобальный) | 204. |

### groups `/groups`
| Метод | Путь | Роли | Поведение |
|------|------|------|-----------|
| GET | `/` | SA, A, T | Список (TEACHER — только свои). |
| GET | `/:id` | SA, A, T (+GroupScope) | Одна группа. TEACHER — только своя. |
| POST | `/` | SA, A | `CreateGroupDto`: `{ name, ageRange, capacity?=20, monthlyFee, fixedMonthlyExpense, color, isActive? }`. |
| PATCH | `/:id` | SA, A | Partial от Create. |
| DELETE | `/:id` | SA, A | 204. |

### students `/students` (роли по умолчанию SA, A, T)
| Метод | Путь | Роли | Поведение |
|------|------|------|-----------|
| GET | `/` | SA,A,T | query `groupId?`, `status?`. TEACHER — только своя группа. |
| GET | `/:id` | SA,A,T | Карточка ученика. |
| POST | `/` | SA,A,T | `CreateStudentDto` (см. ниже). |
| POST | `/bulk` | SA,A,T | `{ items: [...] }` — массовый импорт; ошибочные строки → в `errors[]`. |
| POST | `/scan` | SA,A,T | `{ image }` — распознавание списка детей с фото (AI Vision), возвращает черновики без записи в БД. |
| PATCH | `/:id` | SA,A,T | Partial. |
| POST | `/:id/archive` | SA,A,T | soft-delete (status=ARCHIVED). |
| DELETE | `/:id` | SA, A | 204. |
| GET | `/:id/parents` | SA,A,T | Родители ученика. |
| POST | `/:id/parents` | SA, A | Создать аккаунт родителя и привязать, либо привязать существующего: `{ fullName?, email?, phone?, password?, existingUserId? }`. |
| DELETE | `/:id/parents/:parentId` | SA, A | Отвязать (аккаунт не удаляется). 204. |

`CreateStudentDto`: `firstName, lastName, middleName?, birthDate(ISO), gender, groupId, photoUrl?, medicalNotes?, notes?, motherName?, motherPhone?, fatherName?, fatherPhone?, address?, extraContact?, telegram?, whatsapp?, monthlyFee?|null (≥0), status?`.

### staff `/staff` (роли SA, A)
| Метод | Путь | Поведение |
|------|------|-----------|
| GET | `/` | query `position?`. Включает связанного `user` (если есть учётка). |
| POST | `/` | `CreateStaffBody` (см. ниже). Если `canLogin=true` — сначала создаёт `User` (роль TEACHER/ADMIN, пароль ≥6), затем `Staff` с `userId`. |
| PATCH | `/:id` | Обновляет Staff и (если есть) связанный User; может включить `canLogin` и создать User. |
| DELETE | `/:id` | 204. Связанный User остаётся (userId → null). |

`CreateStaffBody`: `firstName, lastName, middleName?, position, phone, email?, groupId?|null, salary(≥0), hireDate(ISO), canLogin?, password?(≥6), role?(TEACHER|ADMIN), salaryMode?, hourlyRate?, monthlySalaryFixed?, workNorm?(≥1), terminalCode?`.

### teachers `/teachers` (роли SA, A)
| Метод | Путь | Поведение |
|------|------|-----------|
| GET | `/` | Список учителей. |
| PATCH | `/:id/group` | `{ groupId: string|null }` — назначить основную группу. |
| PATCH | `/:id/classes` | `{ groupIds: string[] }` — назначить классы (M:N). |

### attendance `/attendance` (роли SA, A, T)
| Метод | Путь | Роли | Поведение |
|------|------|------|-----------|
| GET | `/` | SA,A,T | query `date(YYYY-MM-DD)`, `groupId?`. Журнал за день. TEACHER — свои классы. Включает `student{id,firstName,lastName,photoUrl}`, сортировка по фамилии. |
| POST | `/mark` | SA,A,T | `MarkAttendanceDto {studentId, date, status, note?}`. **Upsert по (studentId,date)**, ставит `groupId`, `markedById`. Инвалидирует кэш аналитики группы. |
| GET | `/stats` | SA, A | query `groupId, from, to`. Агрегация count по статусам (raw SQL). |

### payments `/payments` (роли SA, A, T)
| Метод | Путь | Роли | Поведение |
|------|------|------|-----------|
| GET | `/` | SA,A,T | query `month?`, `groupId?`. TEACHER — своя группа. Включает данные ученика и телефоны. |
| POST | `/upsert` | SA,A,T | `{studentId, month, amount, paid, method?, comment?}`. См. §9 (fallback суммы, уведомления). |
| DELETE | `/:id` | SA, A | 204. |

### expenses `/expenses` (роли SA, A)
| GET `/` | query `month?, groupId?, category?` |
| POST `/` | `{category, description, amount, month, groupId?|null}` |
| PATCH `/:id` | partial |
| DELETE `/:id` | 204 |

### extra-income `/extra-income` (роли SA, A)
| GET `/` | query `month?, groupId?` |
| POST `/` | `{title, amount(≥0), month, groupId?, comment?}` |
| PATCH `/:id` | partial |
| DELETE `/:id` | 204 |

### finance `/finance` (роли SA, A)
| GET `/summary` | query `month` → глобальная сводка (§9.1) |
| GET `/group` | query `groupId, month` → сводка по группе (§9.1) |

### analytics `/analytics` (роли SA, A)
| GET `/dashboard` | query `month` → globalSummary + `{activeStudents, totalStudents, groups}` |
| GET `/profitability` | query `month` → `{rows[], best, worst}` по группам |
| GET `/trend` | query `monthsBack?=12` → массив `{month, income, expenses, profit}` |

### menu `/menu` (GET — SA,A,T; мутации — SA,A)
| GET `/` | query `date?` или `month?` |
| POST `/` | `{date, meal, title, description?, calories?}` |
| PATCH `/:id` | partial |
| DELETE `/:id` | 204 |

### schedule `/schedule` (GET — SA,A,T; мутации — SA,A)
| GET `/` | query `groupId?` (TEACHER — принудительно своя `groupId`) |
| POST `/` | `CreateScheduleDto {groupId, dayOfWeek(1..7), startTime, endTime, activity, subjectId?, teacherId?, room?}` |
| PATCH `/:id` | partial |
| DELETE `/:id` | 204 |

### subjects `/subjects` (GET — SA,A,T; мутации — SA,A) — школа
| GET `/` | список предметов учреждения |
| POST `/` | `{name(≤80), color?}` |
| PATCH `/:id` | `{name?, color?}` |
| DELETE `/:id` | 204 |

### grades `/grades` (роли SA, A, T) — школа
| GET `/` | query `studentId?, subjectId?, from?, to?`. TEACHER — ученики своих классов. Включает subject/student/author. |
| POST `/` | `UpsertGradeDto {studentId, subjectId, value(1..10), type?, date, comment?(≤500)}`. Создаёт оценку, шлёт push родителям. |
| DELETE `/:id` | 204 |
| GET `/stats/:studentId` | средние по предметам: `[{subjectId,name,color,count,sum,average}]` |

### homework `/homework` (роли SA, A, T) — школа
| GET `/` | query `groupId?, subjectId?, from?, to?`. TEACHER — свои классы. |
| POST `/` | `{subjectId, groupId, title(≤200), description?(≤4000), dueDate, attachments?[]}`. Push родителям группы. |
| PATCH `/:id` | partial |
| DELETE `/:id` | 204 |

### terms `/terms` (GET — SA,A,T,P; мутации — SA,A) — школа
| GET `/` | список периодов (сорт. по startDate) |
| GET `/current` | период, в который попадает сегодня |
| POST `/` | `{name(≤60), type?, startDate, endDate}` (end ≥ start) |
| PATCH `/:id` | partial |
| DELETE `/:id` | 204 |

### diary `/diary` (роли SA, A, T, P)
| GET `/group/:groupId` | query `date`. Запись дневника группы. |
| POST `/group` | SA,A,T. `UpsertDiaryDto {groupId, date, breakfast?, lunch?, snack?, activities?, note?}`. Push родителям **только при первой** записи за день. |
| GET `/kid/:studentId` | query `date`. PARENT — только свой ребёнок. |
| POST `/kid` | SA,A,T. `{studentId, date, mood?, napQuality?, note?, photoUrls?[]}`. |
| GET `/group/:groupId/kids` | SA,A,T. query `date`. Сводка заметок по детям группы. |

### meetings `/meetings` (роли SA, A, T)
| GET `/` | query `groupId?` |
| POST `/` | `{groupId, title(≤200), scheduledAt, location?, description?}`. Рассылает Telegram-уведомление родителям группы. |
| PATCH `/:id` | partial |
| DELETE `/:id` | 204 |

### notifications `/notifications` (все роли)
| GET `/` | список уведомлений пользователя |
| POST `/read-all` | пометить все прочитанными |

### chat `/chat` (роли SA, A, T, P) — см. §9.3
| GET `/unread` | количество непрочитанных переписок (бейдж) |
| GET `/my` | PARENT. query `scope=GENERAL|ADMIN`. Получить/создать переписку + сообщения; ставит `parentReadAt`. |
| POST `/my/messages` | PARENT. `{text, scope?}`. |
| POST `/payment-reminder` | SA, A. `{studentId, month, amount}` → сообщение типа PAYMENT в ADMIN-канал каждого родителя. |
| GET `/conversations` | SA, A, T. Список переписок (TEACHER — GENERAL своих классов; ADMIN — ADMIN-канал учреждения). |
| GET `/conversations/:id/messages` | SA, A, T. Ставит `staffReadAt`. |
| POST `/conversations/:id/messages` | SA, A, T. `{text}`. |

### parent `/parent` (роль PARENT) — все ограничено своим ребёнком
| GET `/me/kids` | дети родителя (ACTIVE) с группой |
| GET `/kids/:id/today` | сводка: ребёнок + посещаемость/расписание/дневник/заметка на сегодня + последний платёж |
| GET `/kids/:id/schedule` | расписание группы ребёнка |
| GET `/kids/:id/attendance` | query `from, to` |
| GET `/kids/:id/payments` | все платежи |
| GET `/kids/:id/grades` | query `from?, to?` |
| GET `/kids/:id/grades/stats` | средние по предметам |
| GET `/kids/:id/homework` | ДЗ группы ребёнка |

### push `/push` (все роли)
| POST `/register` | `{token}` — сохранить Expo push-токен текущего пользователя |
| POST `/unregister` | стереть токен |

### time `/time` (роли SA, A, T) — таймтрекинг, см. §9.4
| POST `/check-in` | `{verifyMethod?, note?, lat?, lon?}`. Геофенс-проверка. |
| POST `/check-out` | `{note?}`. Закрывает смену, считает минуты. |
| GET `/status` | `{isWorking, activeEntry}` |
| GET `/me` | query `month` → личная сводка + расчёт зарплаты |
| POST `/face` | `{descriptor: number[128]}` |
| GET `/face` | `{hasFace, descriptor}` |
| GET `/teachers` | SA, A. query `month` → сводка по всем учителям |
| GET `/audit` | SA, A. query `from?, to?, limit?(≤500, deflt 200)` → журнал check-in с гео |
| PATCH `/:id` | SA, A. Коррекция записи (пересчёт минут). |
| DELETE `/:id` | SA, A. 204. |
| PATCH `/teacher/:id/salary` | SA, A. `{salaryMode?, hourlyRate?, monthlySalaryFixed?, workNorm?}` |
| POST `/setup-demo-teachers` | SUPER_ADMIN. Идемпотентно создаёт 4 демо-учителя. |

### time/terminal — webhook терминала
| POST `/time/terminal/webhook` | **Public**, заголовок `X-Terminal-Api-Key`. См. §9.5. |

### time/terminal/settings (роли SA, A)
| GET `/` | настройки терминала учреждения (`apiKey`, `webhookUrl`) |
| POST `/regenerate` | сгенерировать новый `terminalApiKey` (`kg_<48hex>`) |
| POST `/disable` | стереть ключ |
| POST `/teacher/:id/code` | `{terminalCode?|null}` — привязать код учителю |

### telegram `/telegram` (любой аутентифицированный)
| POST `/send-reminders` | `{items: [{phones[], studentName, amount, daysLeft, groupName?, month?}]}` |
| POST `/send-payment-confirmation` | `{phones[], studentName, groupName?, amount, paid, month?}` |

---

## 9. Бизнес-логика (детально)

### 9.1 Финансы (`FinanceService`)
Все суммы Decimal→Number, на выходе округлены `Math.round`. Кэш Redis 60с (см. §14).

**Сводка по группе** `groupSummary(groupId, month)`:
```
income   = Σ payment.amount [month, paid=true, student.groupId=G]  +  Σ extraIncome.amount [month, groupId=G]
direct   = Σ expense.amount [month, groupId=G]
sharedTotal = Σ expense.amount [month, groupId=null]            // общие расходы учреждения
sharedShare = totalStudents>0 ? sharedTotal * (studentsCount / totalStudents) : 0
expenses = direct + sharedShare + group.fixedMonthlyExpense
profit   = income - expenses
margin   = income>0 ? profit/income : 0          // округление до 4 знаков
debtorsCount = max(0, studentsCount - paidCount) // paidCount = число оплаченных платежей
isProfitable = profit >= 0
```
где `studentsCount` — активные ученики группы, `totalStudents` — все активные ученики учреждения.

**Глобальная сводка** `globalSummary(month)`:
```
totalIncome   = Σ payment.amount [month, paid=true]  +  Σ extraIncome.amount [month]
totalExpenses = Σ expense.amount [month]  +  Σ group.fixedMonthlyExpense [все группы]
netProfit     = totalIncome - totalExpenses
margin        = totalIncome>0 ? netProfit/totalIncome : 0
salaries      = Σ expense.amount [month, category=SALARIES]
taxes         = Σ expense.amount [month, category=TAXES]
isProfitable  = netProfit >= 0
```
Все агрегаты фильтруются по `kindergartenId` пользователя.

### 9.2 Аналитика (`AnalyticsService`)
- `dashboard(month)` = `globalSummary(month)` + `{activeStudents, totalStudents, groups(active count)}`.
- `profitability(month)` = по каждой активной группе вызвать `groupSummary`, вернуть `{rows, best, worst}` (best/worst — по `profit`).
- `trend(monthsBack=12)` = за каждый из последних N месяцев — `globalSummary`, вернуть массив `{month, income, expenses, profit}` от старого к новому.

### 9.3 Чат и разделение каналов (`ChatService`) — критично
Два канала (`ConversationScope`):
- **GENERAL** — родитель ↔ учитель. Учитель **видит**.
- **ADMIN** — родитель ↔ администрация (финансы/оплата). Учитель **НЕ видит** ни в списке, ни по прямой ссылке.

Правила:
- Переписка уникальна по `(groupId, parentId, scope)` — создаётся upsert-ом при первом доступе.
- **Список переписок** (`/chat/conversations`): TEACHER → `scope=GENERAL` и `groupId in teacherGroupIds`; ADMIN/SUPER_ADMIN → `scope=ADMIN` (+ свой `kindergartenId`). То есть админ **видит только финансовый канал**, личные чаты учитель↔родитель ему недоступны.
- **Доступ сотрудника к переписке** (`assertStaffAccess`): TEACHER не может открыть ADMIN-канал (403) и чужой класс (403); ADMIN может только ADMIN-канал своего учреждения.
- **Непрочитанное**: сообщение считается непрочитанным, если последнее сообщение от другой стороны и `readAt < lastMessage.createdAt` (для родителя — `parentReadAt`, для сотрудника — `staffReadAt`).
- **Напоминание об оплате** (`/chat/payment-reminder`): только ADMIN/SUPER_ADMIN. Текст
  `💰 Напоминание об оплате за <month>: <amount> сом. Просьба оплатить.`, kind=PAYMENT, в
  ADMIN-канал **каждого** родителя ученика (M:N + legacy childId). Возвращает `{sent}`.
- **При отправке сообщения** (`send`): создать Message, обновить `lastMessageAt` и readAt
  отправителя, затем:
  - Realtime: `gateway.emitMessage(conversationId, msg)` + `emitConversationUpdate(parentId, {...})` (§10).
  - Push: если отправитель — родитель → уведомить сотрудников (`notifyStaff`: в GENERAL — учителей группы; в ADMIN — админов учреждения). Если сотрудник → push родителю **и** Telegram родителю (по телефонам родителя и его детей; для PAYMENT текст без префикса, иначе `💬 <Имя>:\n<text>`).

### 9.4 Платежи (`PaymentsService.upsert`)
- Проверка тенанта/группы (TEACHER — своя группа).
- **Fallback суммы:** если `amount<=0` — подставить `student.monthlyFee`, иначе `group.monthlyFee`, иначе 0 (защита от обнуления стейл-кэшем фронта).
- Upsert по `(studentId, month)`; при `paid=true` ставит `paidAt=now`, иначе `null`.
- **`becamePaid`** (переход не-оплачено → оплачено) → отправить:
  - Telegram-подтверждение родителям (по `motherPhone/fatherPhone`);
  - Push родителям ученика (`Оплата принята ✅`).
  Обе отправки — best-effort (ошибки логируются, не валят запрос).

### 9.5 Таймтрекинг (`TimeTrackingService`)
- **check-in:** если есть открытая смена (`checkOut=null`) → 409. Если у учреждения заданы
  `latitude/longitude` и пришли `lat/lon` — посчитать расстояние (Haversine, R=6371000м); если
  `distance > checkInRadiusMeters(=150)` → 403. Создать `TimeEntry{date=startOfDay, checkIn=now, verifyMethod, checkInLat/Lon, distanceMeters}`.
- **check-out:** найти последнюю открытую смену; `minutesWorked = max(0, floor((now-checkIn)/60000))`.
- **Расчёт зарплаты за месяц** (`computeMonthForUser`):
  ```
  totalMinutes = Σ minutesWorked за месяц;  totalHours = totalMinutes/60
  HOURLY: estimatedSalary = totalHours * hourlyRate
  FIXED:  baseShare = min(1, totalHours/workNorm)
          base = monthlySalaryFixed * baseShare
          overtime = max(0, totalHours - workNorm)
          overtimeBonus = overtime * (hourlyRate || monthlySalaryFixed/workNorm)
          estimatedSalary = base + overtimeBonus
  completionRate = min(1, totalHours/workNorm)
  ```
  `workNorm` по умолчанию 176. Диапазон месяца считается в **UTC** (`Date.UTC(y,m-1,1)`..`Date.UTC(y,m,1)`).
- **Коррекция админом** (`PATCH /time/:id`): пересчитывает `minutesWorked`, ставит `editedByAdminId`.
- **Face ID:** дескриптор — массив ровно из 128 чисел (иначе 400).

### 9.6 Webhook терминала (`/time/terminal/webhook`, Public)
- Аутентификация по заголовку `X-Terminal-Api-Key` → найти `Kindergarten` по `terminalApiKey`.
- Найти `User` по `(terminalCode=employeeCode, kindergartenId)`; должен быть TEACHER/ADMIN.
- `eventType`: `check-in|check-out|auto` (по умолчанию auto: если есть открытая смена → check-out, иначе check-in).
- Повторный check-in при открытой смене → `{action:'ignored'}`. check-out без открытой смены → 409.
- `verifyMethod=TERMINAL`. Время — `eventTime` или now.

### 9.7 Прочие правила доступа (учитель/родитель)
- Оценки/ДЗ/посещаемость/дневник: TEACHER ограничен `teacherGroupIds`; запись чужому ученику → 403.
- PARENT-доступ к ребёнку: `Student.id == user.childId` ИЛИ `Student.parents` содержит `user.sub`. Иначе 403.

---

## 10. Realtime (Socket.io)

- Сервер Socket.io на том же порту, путь по умолчанию `/socket.io`, CORS `origin:true, credentials:true`.
- **Аутентификация при подключении:** JWT в `handshake.auth.token` (или `Authorization` header). Проверяется `JWT_ACCESS_SECRET`. При неудаче — `disconnect()`. Клиент автоматически входит в комнату `user:<userId>`.
- **Комнаты:** `conv:<conversationId>` (конкретная переписка), `user:<userId>` (личная — для бейджей/списка).
- **События ОТ клиента:**
  - `join` `{conversationId}` — вход в комнату переписки c проверкой доступа (родитель-владелец, учитель группы, админ учреждения).
  - `leave` `{conversationId}`.
- **События ОТ сервера:**
  - `message` — новое сообщение (объект Message с sender) в `conv:<id>`.
  - `conversation` — обновление переписки `{conversationId, lastText, lastMessageAt}` в `user:<parentId>`.

> Клиенты используют протокол Socket.io. На новом бэке либо сохранить совместимость с
> Socket.io-протоколом, либо обновить клиентов на нативные WebSocket.

---

## 11. Очереди (BullMQ → любой воркер/очередь поверх Redis)

- Очереди: `telegram` (используется), плюс зарезервированы `payment-reminder`, `monthly-report`, `audit-log`.
- **Опции задач по умолчанию:** `attempts=3`, backoff `exponential delay=5000ms`, `removeOnComplete {count:1000, age:24h}`, `removeOnFail {count:5000}`.
- **Очередь `telegram`**, job `send-message`, payload `{chatId, text, parse_mode:'HTML'}`.
- **Воркер** (`TelegramProcessor`): берёт `{chatId, text}` (или `{title, description}`), и если заданы `TELEGRAM_BOT_TOKEN` и chatId — шлёт `POST https://api.telegram.org/bot<token>/sendMessage` с `parse_mode:HTML`. Без токена — просто логирует (демо-режим). Ошибка отправки → исключение (ретрай очереди).
- Запуск воркера: `npm run worker` (`node dist/jobs/worker.js`) — отдельный процесс (или в основном — провайдер `@Processor`).

---

## 12. Интеграции

### 12.1 Telegram-бот (`TelegramBotService`)
- **Режим:** long polling `getUpdates` (offset, timeout=25с). Запускается только если задан
  `TELEGRAM_BOT_TOKEN` И (`TELEGRAM_BOT_ENABLED=true` ИЛИ `NODE_ENV=production` и флаг не `false`).
  При `409 Conflict` (другой инстанс уже опрашивает) — экспоненциальный backoff до 60с.
- **Сценарий привязки телефона:**
  - `/start` → приветствие с кнопкой `request_contact`.
  - Пользователь делится контактом → `normalizePhone` (только цифры), `phoneSuffix9` (последние 9 цифр) → **upsert `PhoneChatLink {phoneNormalized=suffix9, chatId, fullName, username}`** → ответ-подтверждение.
- **Матчинг для рассылок** (`TelegramLinkService`): телефоны нормализуются до последних 9 цифр,
  ищутся `PhoneChatLink`, сообщения ставятся в очередь `telegram`. Тексты: напоминание об
  оплате, подтверждение оплаты, уведомление о собрании, произвольное (`notifyByPhones`,
  HTML-escape). Дедуп chatId.

### 12.2 Expo Push (`PushService`)
- Endpoint `https://exp.host/--/api/v2/push/send` (или `EXPO_PUSH_ENDPOINT`), опц. заголовок
  `Authorization: Bearer <EXPO_ACCESS_TOKEN>`.
- Батчи по 100, фильтр токенов `ExponentPushToken[`/`ExpoPushToken[`, `sound:'default'`.
  Best-effort (ошибки только логируются).
- Хелперы: `sendToUser`, `sendToUsers`, `sendToGroupParents` (родители активных детей группы,
  M:N + legacy childId), `sendToStudentParents`.

---

## 13. Триггеры уведомлений (сводка «событие → канал»)

| Событие | Push | Telegram | Realtime |
|--------|------|----------|----------|
| Платёж стал `paid` | родителям ученика | подтверждение родителям | — |
| Новая оценка | родителям ученика | — | — |
| Новое ДЗ | родителям группы | — | — |
| Первая запись дневника за день | родителям группы | — | — |
| Создано собрание | — | родителям группы | — |
| Сообщение в чате (родитель→) | сотрудникам канала | — | message+conversation |
| Сообщение в чате (сотрудник→) | родителю | родителю | message+conversation |
| Напоминание об оплате (админ) | — | (через сообщение чата) | message |

---

## 14. Кэширование (Redis)

- Обёртка cache-aside: `wrap(key, ttl, loader)` — вернуть из кэша или вычислить и положить под TTL. Если Redis недоступен — деградирует в прямой вызов loader (без падения).
- **Ключи и TTL (60с):**
  - `finance:group:<tenant>:<groupId>:<month>`
  - `finance:global:<tenant>:<month>`
  - `analytics:dashboard:<tenant>:<month>`, `analytics:profitability:<tenant>:<month>`, `analytics:trend:<tenant>:<monthsBack>`
  - где `<tenant>` = `kindergartenId` или `'global'`.
- **Инвалидация:** при отметке посещаемости — `delByPattern('analytics:group:<groupId>:*')`. (Финансовый кэш живёт по TTL; `FinanceService.invalidate` существует как утилита.)
- **Прочее в Redis:** `jwt:blacklist:<jti>` (TTL=15м), распределённый лок `lock:<key>` (SET NX EX).

---

## 15. Конфигурация (переменные окружения)

Валидируются при старте (падение при отсутствии обязательных):

| Переменная | Обяз. | По умолч. | Назначение |
|-----------|:----:|-----------|-----------|
| `NODE_ENV` | — | development | development/test/production |
| `PORT` | — | 4000 | порт HTTP |
| `CORS_ORIGIN` | **да** | — | список origin через запятую |
| `DATABASE_URL` | **да** | — | postgres://… |
| `REDIS_URL` | — | — | полный URL (Railway/Upstash); парсится в host/port/password |
| `REDIS_HOST` | да* | redis | если нет REDIS_URL |
| `REDIS_PORT` | — | 6379 | |
| `REDIS_PASSWORD` | — | — | |
| `JWT_ACCESS_SECRET` | **да** (≥16) | — | |
| `JWT_REFRESH_SECRET` | **да** (≥16) | — | |
| `JWT_ACCESS_TTL` | — | 15m | |
| `JWT_REFRESH_TTL` | — | 30d | |
| `THROTTLE_TTL` | — | 60 | сек |
| `THROTTLE_LIMIT` | — | 120 | запросов за TTL |
| `TELEGRAM_BOT_TOKEN` | — | — | бот; без него — демо-режим |
| `TELEGRAM_CHAT_ID` | — | — | дефолтный chat для воркера |
| `TELEGRAM_BOT_ENABLED` | — | — | `true` чтобы включить polling вне prod |
| `EXPO_PUSH_ENDPOINT` | — | exp.host… | |
| `EXPO_ACCESS_TOKEN` | — | — | если включён Expo push security |

(*) `REDIS_HOST` обязателен в Joi-схеме; на практике задаётся либо он, либо `REDIS_URL`.

Формат TTL токенов: `<число><s|m|h|d>` (например `15m`, `30d`).

---

## 16. Нефункциональные требования / прочее

- **Запуск (оригинал):** `prisma migrate deploy && node dist/main.js`. На новом стеке —
  эквивалент миграций + старт сервера + (опц.) отдельный воркер очереди.
- **Логи:** структурные (JSON в stdout), редактировать `authorization`/`cookie` заголовки.
- **Swagger:** в не-prod поднимать UI на `/api/docs` (Bearer auth).
- **Graceful shutdown:** закрывать соединения БД/Redis.
- **Сиды/демо:** `prisma/seed.ts` (тестовые данные), `POST /time/setup-demo-teachers`
  (4 демо-учителя, пароль `Teacher123456!`). Это удобно повторить для приёмочного тестирования.
- **Тесты-ориентиры:** в оригинале покрыты разделение каналов чата, доступ ролей, «напоминание
  об оплате — только админ», финансовые формулы, гварды. Эти инварианты — обязательны к
  воспроизведению.

---

## 17. Контрольный список совместимости (acceptance)

1. Пути `/api/v1/*`, конверт `{data}`, форматы ошибок — идентичны.
2. JWT access (15м) + refresh-cookie (30д, path `/api/v1/auth`), ротация и blacklist работают.
3. Мульти-тенант изоляция по `kindergartenId` на всех list/get/mutate.
4. Ролевые ограничения и `teacherGroupIds`-логика.
5. Разделение чат-каналов GENERAL/ADMIN (учитель не видит финансы; напоминания шлёт только админ).
6. Финансовые формулы (§9.1) дают те же числа (округление до целых, margin 4 знака).
7. Расчёт зарплаты и геофенс таймтрекинга (§9.5).
8. Уникальные ограничения БД (§6) и upsert-поведение (attendance, payment, diary, kidNote, conversation).
9. Socket.io события `message`/`conversation`, комнаты `conv:`/`user:`.
10. Telegram (привязка по последним 9 цифрам, очередь `send-message`) и Expo push.

---

*Сгенерировано по состоянию кода в `server/` на момент написания. При расхождениях
первоисточник — код (`server/prisma/schema.prisma` и `server/src/modules/*`).*
