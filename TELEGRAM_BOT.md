# 🤖 Telegram Bot - Уведомления об Оплате

Бот автоматически отправляет родителям уведомления об оплате через Telegram:
- ✅ Подтверждение оплаты (когда родитель оплатил)
- ⏰ Напоминание об оплате (когда срок заканчивается)

## 🚀 Как настроить бот?

### 1. Создать бота в Telegram

1. Откройте Telegram и найдите **@BotFather**
2. Нажмите `/start`
3. Нажмите `/newbot`
4. Введите имя бота (например, "KinderCRM Payment Notifications")
5. Введите username (должен заканчиваться на `_bot`)
6. **Скопируйте токен** (строка вида `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. Установить переменные окружения

В файле `.env` на сервере добавьте:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=9999999  # (опционально, для отладки)
```

### 3. Связать Telegram ID родителя с системой

Каждый родитель должен:
1. Найти бота по username
2. Нажать `/start` чтобы получить свой Chat ID
3. Администратор добавляет Chat ID в профиль родителя

## 📊 Типы уведомлений

### 1. Подтверждение оплаты ✅
Отправляется автоматически при отметке платежа как оплачено:

```
📊 Информация об оплате

👶 Ребёнок: Айша Ахмедова
📍 Группа: Солнышко
🗓️ Месяц: May 2026

💰 Сумма: 1200 сомони
📌 Статус: ✅ ОПЛАЧЕНО
```

### 2. Напоминание об оплате ⏰
Отправляется за несколько дней до срока:

```
⏰ Напоминание об оплате

👶 Айша

⚠️ Осталось дней для оплаты: 5
💰 Сумма: 1200 сомони

Пожалуйста, оплатите вовремя!
```

## 🔌 Интеграция с системой

Боту НЕ нужны входящие сообщения от Telegram. Он только **отправляет** уведомления.

### Архитектура интеграции

```
1. Родитель добавляет Chat ID через API
   POST /v1/telegram-link/add
   { "studentId": "...", "chatId": 123456789 }

2. Администратор создаёт/обновляет платёж
   POST /v1/payments/create-or-update
   { "studentId": "...", "month": "2026-05", "amount": 1200, "paid": true }

3. PaymentsService вызывает TelegramService
   → Получает все Chat IDs для ребёнка из TelegramLink таблицы
   → Отправляет уведомление каждому родителю

4. TelegramService добавляет задачу в BullMQ очередь
   → TelegramProcessor обрабатывает задачу
   → Отправляет уведомление через Telegram Bot API
```

### Когда отправляются уведомления?

1. **При отметке платежа как оплаченного** - подтверждение оплаты отправляется всем привязанным родителям
2. **По расписанию** - автоматические напоминания об оплате (настраивается отдельно)

## 🛠️ Техническая информация

### Архитектура

- **TelegramService** - сервис для отправки уведомлений
- **BullMQ Queue** - асинхронная очередь для отправки сообщений
- **TelegramProcessor** - воркер для реальной отправки через API

### Как это работает?

```
Администратор отмечает платёж → Система вызывает TelegramService.notifyPaymentStatus() 
→ Сообщение добавляется в BullMQ очередь → Воркер отправляет через Telegram Bot API
→ Родитель получает уведомление
```

## 🔗 API для связывания Telegram Chat ID

### Добавить Chat ID для ребёнка
```bash
curl -X POST http://localhost:4000/api/v1/telegram-link/add \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "child_id_here",
    "chatId": 123456789
  }'
```

### Получить все Chat IDs для ребёнка
```bash
curl http://localhost:4000/api/v1/telegram-link/{studentId} \
  -H "Authorization: Bearer {token}"
```

### Удалить Chat ID
```bash
curl -X DELETE http://localhost:4000/api/v1/telegram-link/{studentId}/{chatId} \
  -H "Authorization: Bearer {token}"
```

## 🔗 API для управления платежами

### Создать или обновить платёж (с отправкой уведомления)
```bash
curl -X POST http://localhost:4000/api/v1/payments/create-or-update \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "child_id_here",
    "month": "2026-05",
    "amount": 1200,
    "paid": true
  }'
```

**Важно**: Когда `paid: true`, автоматически отправляется Telegram уведомление всем родителям, привязанным к этому ребёнку.

### Получить платёж по ID
```bash
curl http://localhost:4000/api/v1/payments/{paymentId} \
  -H "Authorization: Bearer {token}"
```

### Получить все платежи ребёнка
```bash
curl http://localhost:4000/api/v1/payments/student/{studentId} \
  -H "Authorization: Bearer {token}"
```

## 📱 Как родитель получает свой Chat ID?

Существует несколько способов:

### Способ 1: Через команду в боте
1. Найти бота по username
2. Нажать `/start`
3. Бот отправляет сообщение с Chat ID

### Способ 2: Вручную через @userinfobot
1. Нажать `/start` в боте `@userinfobot`
2. Копировать свой ID

### Способ 3: Из логов Telegram
Администратор может смотреть логи запросов от Telegram

## 🔐 Безопасность

- ✅ Токен бота хранится в переменной окружения
- ✅ Только авторизованные чаты получают уведомления
- ✅ Каждый родитель видит только информацию о своём ребёнке
- ✅ Все запросы логируются

## ⚠️ Важные замечания

1. **Chat ID должен быть число** - это целое число, не строка
2. **Токен - это секрет** - не делитесь им
3. **Сохраняйте Chat ID в защищённом месте** - это идентификатор чата родителя
4. **Убедитесь, что BullMQ работает** - без него уведомления не будут отправлены

## 🐛 Troubleshooting

### "Бот не отправляет сообщения"
- Проверьте `TELEGRAM_BOT_TOKEN` в .env
- Убедитесь, что Chat ID правильный (целое число)
- Проверьте, что BullMQ включен и работает
- Посмотрите логи: `docker logs kindergarten-api`

### "Сообщение отправилось, но не пришло"
- Убедитесь, что родитель не заблокировал бота
- Проверьте, что Chat ID принадлежит нужному чату
- Попробуйте отправить тестовое сообщение вручную

### "Нужно найти Chat ID родителя"
```bash
# Отправить тестовое сообщение и посмотреть ответ
curl -X POST https://api.telegram.org/bot{YOUR_BOT_TOKEN}/sendMessage \
  -H "Content-Type: application/json" \
  -d '{"chat_id": -1001234567890, "text": "Test message"}'
```

## 📚 Дополнительные ресурсы

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#botfather)
- [Getting Chat ID](https://stackoverflow.com/questions/32423837/telegram-bot-how-to-get-chat-id-for-a-user)
