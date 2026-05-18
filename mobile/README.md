# KinderCRM Mobile (redi)

Мобильное приложение KinderCRM на **Expo SDK 54 + React Native 0.81**.
Два режима: **учитель** (приход/уход с Face ID, отметка посещаемости) и **родитель** (расписание ребёнка, статус в саду, оплата).

Дизайн — Sprout (мята + крем, Plus Jakarta Sans). Бэк общий с веб-версией: NestJS на Railway.

---

## Стек

| Слой | Что |
|---|---|
| Runtime | Expo SDK 54, React Native 0.81, React 19 |
| Навигация | `@react-navigation/native-stack` + `@react-navigation/bottom-tabs` |
| Стор | `zustand` + `@react-native-async-storage/async-storage` (персист токена) |
| HTTP | `axios` (общий клиент с авто-токеном) |
| Биометрия | `expo-local-authentication` (Face ID / Touch ID) |
| Шрифты | `@expo-google-fonts/plus-jakarta-sans` |
| Иконки | `lucide-react-native` |
| Даты | `dayjs` |

---

## Структура

```
mobile/
├── App.tsx                  # точка входа: шрифты + hydration + навигатор
├── index.ts                 # registerRootComponent
├── src/
│   ├── api/
│   │   ├── http.ts          # axios + AsyncStorage token interceptor
│   │   ├── auth.ts          # login / me
│   │   ├── time.ts          # учитель: check-in/out + сводка месяца
│   │   ├── students.ts      # список детей группы (для учителя)
│   │   ├── attendance.ts    # отметка посещаемости
│   │   └── parent.ts        # парент-API: kids / today / schedule / payments
│   ├── components/
│   │   ├── Screen.tsx       # SafeAreaView обёртка
│   │   ├── Card.tsx         # карточка с тенью
│   │   ├── Btn.tsx          # кнопка (primary / secondary / danger / ghost)
│   │   └── Avatar.tsx       # инициалы в квадрате со скруглением
│   ├── navigation/
│   │   └── index.tsx        # Auth Stack + Main Tabs (роли разные табы)
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── TeacherHomeScreen.tsx        # check-in/out + Face ID + KPI
│   │   ├── TeacherAttendanceScreen.tsx  # список группы, 4 статуса
│   │   ├── ParentHomeScreen.tsx         # ребёнок + статус + сегодня
│   │   ├── ParentSchedulePlaceholder.tsx  # расписание по дням недели
│   │   ├── ParentPaymentsPlaceholder.tsx  # история оплат + KPI
│   │   ├── ParentChatPlaceholder.tsx      # (заглушка)
│   │   └── ProfileScreen.tsx
│   ├── store/
│   │   └── authStore.ts     # zustand + persist
│   └── theme/
│       └── colors.ts        # Sprout токены (colors, radius, shadow, font)
└── package.json
```

---

## Запуск

```powershell
cd mobile
npm install
npm start
```

Дальше:
- На iPhone — открой **Expo Go**, отсканируй QR из терминала. Должен быть в одной Wi-Fi сети с ноутом.
- На Android — `Expo Go` тоже работает. Или `npm run android` для эмулятора.
- В браузере — `npm run web` (ограниченный режим, Face ID и часть нативных модулей не работают).

---

## Конфигурация бэка

URL бэка прибит в [src/api/http.ts](src/api/http.ts):

```ts
const BASE_URL = 'https://kin-production-b330.up.railway.app/api'
```

Чтобы временно подключиться к локальному бэку:
1. Найди IP ноута в Wi-Fi: `ipconfig` → `IPv4 Address` (например `192.168.1.42`)
2. Замени `BASE_URL` на `http://192.168.1.42:4000/api`
3. Бэк должен быть запущен с `npm run start:dev` (см. [server/README](../server))

---

## Роли и навигация

После логина роль приходит в `user.role` из `/v1/auth/me`. На основе этого строится таб-бар:

**Учитель** (`TEACHER`):
- **Группа** — главный экран, check-in/out, KPI часов и зарплаты
- **Отметить** — список группы с 4 статусами (Здесь / Нет / Болеет / Отпуск)
- **Я** — профиль, выход

**Родитель** (`PARENT`):
- **Главная** — ребёнок, статус на сегодня, ближайшие занятия, оплата
- **Сегодня** — расписание по дням недели
- **Оплата** — KPI оплачено/долг + история по месяцам
- **Чат** — (заглушка, в разработке)
- **Профиль**

---

## Face ID / Touch ID

Используется `expo-local-authentication`. Учитель при check-in/out проходит биометрию **локально на устройстве** (Face ID на iPhone, Touch ID или PIN на Android). На бэк отправляется только факт подтверждения — биометрические данные с устройства не уходят.

Если устройство не поддерживает или биометрия не настроена — приходит/уходит происходит без неё (запись помечается `verifyMethod: MANUAL`).

---

## Дизайн-система Sprout

Все цвета, радиусы, тени и шрифты — в [src/theme/colors.ts](src/theme/colors.ts). Не хардкодь, используй токены:

```tsx
import { colors, radius, shadow } from '../theme/colors'

<View style={{
  backgroundColor: colors.primarySoft,
  borderRadius: radius.md,
  ...shadow.sm,
}} />
```

Палитра:
- `primary` `#4FB286` — мята (бренд)
- `bg` `#FBF9F4` — крем (фоны)
- `yellow` / `rose` / `lilac` — акценты для KPI и статусов

---

## TypeScript

```powershell
npx tsc --noEmit
```

Все экраны и API строго типизированы, `strict: true`.

---

## Известные ограничения

- **Web-режим (`npm run web`)** — Face ID и native-stack работают частично. Для разработки UI ок, но для отладки auth-флоу — лучше Expo Go на телефоне.
- **EAS build** — пока не настроен. Для публикации в App Store / Play Store потребуется `eas.json` и Apple/Google аккаунты.
- **Push-уведомления** — пока не подключены, в плане через `expo-notifications`.
- **Тёмная тема** — пока нет, цвета жёстко light.

---

## Часто встречающиеся проблемы

**`Unable to resolve module X`** — модуль не установлен. `npm install <name>` и перезагрузи Expo Go (тряхни телефон → Reload).

**`Cannot read property 'forEach' of null` в `processTransform`** — в стиле `transform: undefined`. Меняй на условный массив: `pressed && { transform: [{ scale: 0.97 }] }`.

**`Network Error` / `ECONNREFUSED`** — бэк недоступен по URL из `http.ts`. Проверь Railway-инстанс или поправь `BASE_URL`.

**`Cannot GET /api/v1/...`** — эндпоинта нет на бэке. Скорее всего, нужно перепушить сервер на Railway, чтобы он подхватил новый код.
