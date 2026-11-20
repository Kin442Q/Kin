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

Адрес бэка по умолчанию (боевой Railway) задан в [src/lib/config.ts](src/lib/config.ts). Его можно переопределить переменной `EXPO_PUBLIC_API_URL` — без правки кода (шаблон: [.env.example](.env.example)).

Чтобы подключиться к локальному бэку:
1. Найди IP ноута в Wi-Fi: `ipconfig` → `IPv4 Address` (например `192.168.1.42`)
2. Создай `mobile/.env.local` (не коммитится): `EXPO_PUBLIC_API_URL=http://192.168.1.42:4000` (без `/api` на конце), затем Reload в приложении
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
- **EAS build** — настроен: профиль `preview` (APK для проверки на телефоне) и `production` (AAB для Google Play и сборка для App Store), см. «Публикация в магазины» ниже.
- **Push-уведомления** — подключены через `expo-notifications`; для сборок из магазинов нужны ключи FCM (Android) и APNs (iOS), см. ниже.
- **Тёмная тема** — пока нет, цвета жёстко light.

---

## Публикация в магазины

Нужны аккаунты Apple Developer Program и Google Play Console, а также вход в EAS (`npx eas-cli login`).

1. **Номер сборки.** Перед КАЖДОЙ загрузкой новой сборки увеличьте `ios.buildNumber` (строка: "2", "3"…) и `android.versionCode` (число) в `app.json`: магазины не принимают повторный номер. `version` (1.0.0) меняйте только при заметных для пользователей обновлениях.
2. **Сборка.** `npx eas-cli build --platform android --profile production` даёт AAB для Google Play, `--platform ios --profile production` — сборку для App Store (сертификаты EAS создаст сам после входа в Apple-аккаунт). Профиль `production` явно задаёт боевой адрес сервера. Профиль `preview` по-прежнему собирает APK для внутренних проверок.
3. **Загрузка.** `npx eas-cli submit --platform android --latest` и `--platform ios --latest`, либо вручную через Play Console и App Store Connect (Transporter).
4. **Push в магазинных сборках.** Android: ключ FCM v1 загрузить в EAS (`eas credentials`). iOS: ключ APNs EAS создаёт при сборке.
5. **Политика конфиденциальности** лежит в `public/privacy/index.html` веб-приложения (адрес `/privacy/`). Её адрес нужен в карточках обоих магазинов; перед отправкой её нужно заполнить (оператор, почта) и показать юристу.

---

## Часто встречающиеся проблемы

**`Unable to resolve module X`** — модуль не установлен. `npm install <name>` и перезагрузи Expo Go (тряхни телефон → Reload).

**`Cannot read property 'forEach' of null` в `processTransform`** — в стиле `transform: undefined`. Меняй на условный массив: `pressed && { transform: [{ scale: 0.97 }] }`.

**`Network Error` / `ECONNREFUSED`** — бэк недоступен по URL из `http.ts`. Проверь Railway-инстанс или поправь `BASE_URL`.

**`Cannot GET /api/v1/...`** — эндпоинта нет на бэке. Скорее всего, нужно перепушить сервер на Railway, чтобы он подхватил новый код.
