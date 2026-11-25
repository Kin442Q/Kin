# Мактаби ман — мобильное приложение

Мобильное приложение школьной платформы «Мактаби ман» на **Expo SDK 54 + React Native 0.81**. Один вход для
директора, учителей, родителей и учеников: роль берётся из аккаунта. Сервер общий с веб-версией (NestJS на Railway).

Интерфейс на русском, английском и таджикском; светлая и тёмная тема. Дизайн и правила для новых экранов:
**[DESIGN.md](DESIGN.md)**.

---

## Стек

| Слой | Что |
|---|---|
| Runtime | Expo SDK 54, React Native 0.81 (новая архитектура, edge-to-edge на Android), React 19 |
| Навигация | `@react-navigation/native-stack` + `@react-navigation/bottom-tabs` (своя панель `FloatingTabBar`) |
| Состояние | `zustand` + `@react-native-async-storage/async-storage` (сессия, тема, язык) |
| HTTP / realtime | `axios` (токен и обновление сессии) и `socket.io-client` (чат) |
| Шрифты | Inter (текст) и Mont Black (крупные заголовки), файлы в `assets/fonts` |
| Иконки / графика | `lucide-react-native`, `react-native-svg` (фон, градиенты) |
| Уведомления | `expo-notifications` (push), `expo-device` |
| Камера | `expo-camera` (вход ученика по QR-коду) |
| Файлы | `expo-document-picker` (материалы к уроку) |
| Даты | `dayjs` |

---

## Структура

```
mobile/
├── App.tsx, index.ts          # точка входа: шрифты, сессия, тема, язык
├── app.json, app.config.js    # настройки Expo; app.config.js подключает google-services.json для push на Android
├── eas.json                   # профили сборки: preview (APK) и production (AAB / App Store)
├── DESIGN.md                  # дизайн-система
└── src/
    ├── api/                   # запросы к серверу по разделам (auth, parent, student, school, chat, …)
    ├── components/            # общие компоненты (Screen, Card, Btn, Skeleton, SegmentedTabs, …)
    ├── i18n/                  # uiText, языки, messages.json (ru → en/tg)
    ├── lib/                   # push, уведомления, ошибки, доступ к разделам (features), хуки
    ├── navigation/            # вход (AuthNavigator) и основное приложение (вкладки по ролям)
    ├── screens/               # экраны
    ├── store/                 # authStore
    └── theme/                 # colors (токены), themedStyles, themeStore, fonts, labels
```

---

## Запуск

```powershell
cd mobile
npm install
npm start
```

- Android: `npm run android` (эмулятор) или установить APK из профиля `preview`.
- iPhone: Expo Go на iPhone поддерживает другую версию SDK, чем наше приложение (SDK 54), поэтому для проверки на
  iPhone нужна сборка TestFlight.
- Web (`npm run web`) ограничен: часть нативных модулей (камера, push) не работает.

---

## Конфигурация сервера

Адрес сервера по умолчанию задан в [src/lib/config.ts](src/lib/config.ts). Переопределить без правки кода:
переменная `EXPO_PUBLIC_API_URL` (шаблон: [.env.example](.env.example)).

Локальный сервер: найти IP компьютера в Wi-Fi (`ipconfig`), создать `mobile/.env.local` (не коммитится):
`EXPO_PUBLIC_API_URL=http://192.168.1.42:4000` (без `/api` на конце), перезагрузить приложение. Сервер запускается
как описано в [server/README](../server).

---

## Роли и навигация

После входа роль приходит в `user.role`. Вкладки зависят от роли, а разделы, выключенные для школы, скрываются
(`src/lib/features.ts`).

| Роль | Вкладки | Экраны поверх вкладок |
|---|---|---|
| Директор / админ (`ADMIN`, `SUPER_ADMIN`) | Сводка · Классы · Оплаты · Я | Ученики, Расходы, Родительские собрания |
| Учитель (`TEACHER`) | Кабинет · Отметить · Журнал · ДЗ · Я | Чат с родителями, Мой класс, Состав ДЗ, Материалы к уроку |
| Родитель (`PARENT`) | Главная · Расписание · Оценки · Оплата · Я | Чат с учителем / администрацией |
| Ученик (`STUDENT`) | Главная · ДЗ · Оценки · Учёба · Я | Библиотека, Расписание, Квизы, Экзамен, Игры, Материалы |

Названия файлов `ParentSchedulePlaceholder` и `ParentPaymentsPlaceholder` историческое: это рабочие экраны
(расписание и оплаты), не заглушки.

«Оповещения» (колокольчик на главной, «Профиль → Уведомления»): события из чата, отметки отсутствия, оценок, ДЗ, оплат.
Push-токен регистрируется при входе; причины, по которым push не приходят, видны на экране «Уведомления».

---

## Проверка типов

```powershell
npx tsc --noEmit
```

`strict: true`.

---

## Публикация в магазины

Нужны аккаунты Apple Developer Program и Google Play Console, а также вход в EAS (`npx eas-cli login`).

1. **Номер сборки.** Перед КАЖДОЙ загрузкой новой сборки увеличьте `ios.buildNumber` (строка: "2", "3"…) и
   `android.versionCode` (число) в `app.json`: магазины не принимают повторный номер. `version` меняйте только при
   заметных пользователю обновлениях.
2. **Сборка.** `npx eas-cli build --platform android --profile production` даёт AAB для Google Play,
   `--platform ios --profile production` — сборку для App Store. Профиль `production` задаёт боевой адрес сервера.
   Профиль `preview` собирает APK для внутренних проверок.
3. **Загрузка.** `npx eas-cli submit --platform android --latest` и `--platform ios --latest`, либо вручную через
   Play Console и App Store Connect.
4. **Push в магазинных сборках.**
   - Android: (а) файл `google-services.json` из Firebase Console (проект → приложение Android с пакетом
     `cyou.tahlilgar.maktabiman`) положить в `mobile/google-services.json` или задать файловую переменную EAS
     `GOOGLE_SERVICES_JSON` (его подхватывает `app.config.js`; без файла сборка предупреждает и собирается без push);
     (б) ключ сервисного аккаунта FCM v1 загрузить в EAS (`eas credentials`).
   - iOS: ключ APNs EAS создаёт при сборке; плагин `expo-notifications` в `app.json` добавляет нужное разрешение.
5. **Политика конфиденциальности** лежит в `public/privacy/index.html` веб-приложения (адрес `/privacy/`).

---

## Известные ограничения

- В приложении нет аналитики и отчётов о сбоях: причины проблем на устройствах видно только из описания пользователя.
- SMS-уведомления не работают: на сервере стоит заглушка (`server/src/modules/push/sms.service.ts`), нужен
  SMS-провайдер.
- Тексты push-уведомлений пока только на русском (язык пользователя на сервере не хранится).

---

## Часто встречающиеся проблемы

**`Unable to resolve module X`** — модуль не установлен. `npm install <name>`, затем перезагрузить приложение.

**`Cannot read property 'forEach' of null` в `processTransform`** — в стиле `transform: undefined`. Заменить на
условный массив: `pressed && { transform: [{ scale: 0.97 }] }`.

**`Network Error` / `ECONNREFUSED`** — сервер недоступен по адресу из `src/lib/config.ts`.

**`expo config` завершается с кодом 1 без сообщения** — для плагина в `app.json` не установлен модуль
(например `expo-camera`): выполнить `npm install` в папке `mobile`.
