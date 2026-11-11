/**
 * Адрес сервера. По умолчанию — боевой Railway.
 *
 * Для разработки (Expo Go на телефоне + локальный бэкенд) задайте
 * EXPO_PUBLIC_API_URL в mobile/.env.local — см. mobile/.env.example.
 * Значение подставляется при сборке бандла, поэтому читаем его строго
 * как `process.env.EXPO_PUBLIC_API_URL` (динамический доступ не работает),
 * а после правки .env.local приложение нужно перезагрузить (Reload).
 */
const PROD_SERVER_URL = 'https://api.tahlilgar.cyou'

/** Хост без завершающего слэша и без /api: нужен сокету. */
export const SERVER_URL = (process.env.EXPO_PUBLIC_API_URL || PROD_SERVER_URL).replace(/\/+$/, '')

/** База REST API. */
export const API_URL = `${SERVER_URL}/api`
