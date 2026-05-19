-- Expo push token для отправки уведомлений на мобильное устройство пользователя.
ALTER TABLE "User" ADD COLUMN "expoPushToken" TEXT;
