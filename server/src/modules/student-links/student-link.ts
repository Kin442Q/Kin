import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Личная ссылка ученика. Чистая логика без Nest и Prisma.
 *
 * Вид токена: `<userId>.<подпись>`, где подпись — первые 16 байт
 * HMAC-SHA256(секрет, `<userId>:<версия>`) в base64url (22 символа). Токен не
 * хранится: его можно в любой момент пересчитать по id аккаунта и версии. Новая
 * версия (перевыпуск) даёт другую подпись, поэтому старая ссылка перестаёт работать.
 */
const SIG_BYTES = 16
const TOKEN_RE = /^([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{22})$/

function signature(secret: string, userId: string, version: number): string {
  return createHmac('sha256', secret).update(`${userId}:${version}`).digest().subarray(0, SIG_BYTES).toString('base64url')
}

export function makeStudentToken(secret: string, userId: string, version: number): string {
  return `${userId}.${signature(secret, userId, version)}`
}

export function parseStudentToken(token: string): { userId: string; sig: string } | null {
  const m = TOKEN_RE.exec(token)
  return m ? { userId: m[1], sig: m[2] } : null
}

/**
 * Подпись верна для текущей версии аккаунта. `version` null или undefined —
 * доступа нет (не выдан или отозван): ссылка не подходит.
 */
export function verifyStudentToken(secret: string, token: string, version: number | null | undefined): boolean {
  if (version == null) return false
  const parsed = parseStudentToken(token)
  if (!parsed) return false
  const expected = Buffer.from(signature(secret, parsed.userId, version))
  const given = Buffer.from(parsed.sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/**
 * Достать токен из того, что вставил человек: целая ссылка `…/s/<токен>`
 * (с хвостовым слэшем или параметрами) или просто токен. Мусор → null.
 */
export function extractStudentToken(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  if (TOKEN_RE.test(text)) return text
  const m = /\/s\/([A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{22})(?=$|[/?#\s])/.exec(text)
  return m ? m[1] : null
}
