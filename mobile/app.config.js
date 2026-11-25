/**
 * Динамическая часть настроек поверх app.json.
 *
 * Android не получает push, пока в сборку не попал google-services.json (ключ Firebase приложения): без него
 * getExpoPushTokenAsync падает, и приложение не может зарегистрироваться на уведомления. Файл выдаёт Firebase
 * Console (Project settings → Your apps → Android → пакет cyou.tahlilgar.maktabiman). Положить его можно двумя
 * способами:
 *   1) файлом mobile/google-services.json рядом с app.json (это не пароль, файл коммитится вместе с проектом);
 *   2) файловой переменной EAS с именем GOOGLE_SERVICES_JSON (тогда в репозитории файла нет).
 * Второй ключ — сервисный аккаунт FCM V1 — загружается в EAS отдельно (eas credentials), в сборку он не входит.
 */
const fs = require('fs')
const path = require('path')

module.exports = ({ config }) => {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON
  const local = path.join(__dirname, 'google-services.json')
  const googleServicesFile = fromEnv || (fs.existsSync(local) ? './google-services.json' : null)

  if (!googleServicesFile) {
    // Сборка не падает (iOS и проверка вёрстки собираются и так), но говорит об этом громко
    console.warn(
      '\n⚠️  google-services.json не найден: Android-сборка будет БЕЗ push-уведомлений.\n' +
        '    Положите файл в mobile/google-services.json или задайте файловую переменную EAS GOOGLE_SERVICES_JSON.\n',
    )
    return config
  }

  return {
    ...config,
    android: { ...config.android, googleServicesFile },
  }
}
