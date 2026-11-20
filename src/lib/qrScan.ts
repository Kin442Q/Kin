import jsQR from 'jsqr'

/**
 * Личная ссылка ученика, зашитая в QR на его карточке: `https://сайт/s/<токен>`.
 * Токен: `<id аккаунта>.<подпись>` (22 символа base64url). Правило то же, что на сервере
 * (server/src/modules/student-links/student-link.ts): всё, что на токен не похоже, — не наш код.
 */
const TOKEN_RE = /^([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{22})$/
const LINK_RE = /\/s\/([A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{22})(?=$|[/?#\s])/

/**
 * Достать токен из того, что прочитано с QR: целая ссылка `…/s/<токен>` (с хвостовым слэшем или
 * параметрами) или сам токен. Любой другой код (чужая ссылка, текст, Wi-Fi) — null.
 *
 * Из прочитанного берётся только токен, а не адрес: переходим мы всегда на свой маршрут `/s/<токен>`,
 * поэтому QR с чужой ссылкой никуда нас не уведёт. Подпись токена проверяет сервер.
 */
export function studentTokenFromQr(text: string): string | null {
  const value = text.trim()
  if (!value) return null
  if (TOKEN_RE.test(value)) return value
  const match = LINK_RE.exec(value)
  return match ? match[1] : null
}

/** Прочитать QR-код с кадра камеры. Нет кода в кадре — null. */
export function decodeQr(data: Uint8ClampedArray, width: number, height: number): string | null {
  // inversionAttempts: только обычная полярность. Карточки печатаются тёмным по светлому, а поиск
  // инверсии удваивает время разбора кадра на слабых телефонах.
  const result = jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
  return result ? result.data : null
}
