/**
 * Чистая, типизированная функция конфигурации.
 * Все секреты приходят из переменных окружения; здесь же документируется
 * структура config-объекта, который потом инжектится через ConfigService.
 */
export type AppConfig = ReturnType<typeof configuration>

export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim()),

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: (() => {
    // Если задан полный URL (Railway / Upstash) — парсим его.
    const url = process.env.REDIS_URL
    if (url) {
      try {
        const u = new URL(url)
        return {
          host: u.hostname,
          port: parseInt(u.port || '6379', 10),
          password: u.password || undefined,
        }
      } catch {
        // если URL невалидный — упадём на ENV-переменные ниже
      }
    }
    return {
      host: process.env.REDIS_HOST ?? 'redis',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD,
    }
  })(),

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    /** Секрет подписи личных ссылок учеников; не задан — производная от refresh-секрета. */
    studentLinkSecret: process.env.STUDENT_LINK_SECRET || undefined,
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },

  // Письма (приглашения и сброс пароля) — через HTTP API Resend.
  mail: {
    resendApiKey: process.env.RESEND_API_KEY || undefined,
    apiUrl: process.env.RESEND_API_URL || 'https://api.resend.com/emails',
    from: process.env.MAIL_FROM || 'Мактаби ман <no-reply@tahlilgar.cyou>',
    /** Адрес сайта для ссылок в письмах, без слэша на конце. */
    appUrl: (process.env.APP_URL || 'https://tahlilgar.cyou').replace(/\/+$/, ''),
  },

  // Письма владельцу, когда на сервере случается ошибка (через запятую). Пусто — оповещения выключены.
  alerts: {
    emails: (process.env.ALERT_EMAIL ?? '')
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  // Хранилище загруженных файлов (материалы урока, библиотека).
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    /** Корень локального хранилища. В проде — смонтированный том (иначе загрузка отключена). */
    dir: process.env.STORAGE_DIR || undefined,
    /** Сколько МБ файлов можно хранить на одну школу. */
    quotaMb: parseInt(process.env.STORAGE_QUOTA_MB ?? '2048', 10),
  },
})
