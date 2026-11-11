/**
 * Очистка текста перед тем, как он попадёт в письмо-оповещение: адреса почты, токены и длинные идентификаторы
 * в сообщениях и путях маскируются, чтобы в почту владельцу не утекли личные данные и ссылки-доступы.
 */

const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
// Длинная «абракадабра» с цифрами: ключи, токены, cuid/uuid. Без цифр не трогаем — это обычные имена из кода.
const TOKEN_RE = /\b(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{24,}\b/g
const TOKEN_SEGMENT_RE = /^(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{20,}$/
const DIGITS_RE = /^\d+$/

export function scrubText(input: string, max = 500): string {
  const clean = input.replace(JWT_RE, '[jwt]').replace(EMAIL_RE, '[email]').replace(TOKEN_RE, '[token]')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/** Путь без query и без идентификаторов: `/a/123/b/cm3x…` → `/a/:n/b/:id`. */
export function scrubPath(url: string): string {
  const path = url.split('?')[0].split('#')[0]
  return path
    .split('/')
    .map((segment) => {
      if (DIGITS_RE.test(segment)) return ':n'
      if (TOKEN_SEGMENT_RE.test(segment)) return ':id'
      return segment
    })
    .join('/')
}
