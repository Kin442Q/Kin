/**
 * Сколько прокси стоит перед сервером. На Railway запрос идёт через один прокси, а настоящий адрес клиента
 * приходит в X-Forwarded-For. Если не сказать Express доверять прокси, `req.ip` у всех будет адресом прокси:
 * лимит запросов станет общим на всех пользователей сразу.
 *
 * Значение из TRUST_PROXY:
 *   не задано или пусто — 1 (один прокси, как на Railway);
 *   число              — столько прокси;
 *   false / 0 / off     — прокси нет (запуск без прокси, например локально);
 *   true               — доверять всем (небезопасно: адрес можно подделать заголовком);
 *   иначе              — список адресов или подсетей через запятую (формат Express).
 */
export function parseTrustProxy(value?: string | null): boolean | number | string {
  const v = (value ?? '').trim()
  if (v === '') return 1
  const lower = v.toLowerCase()
  if (lower === 'false' || lower === 'off' || lower === 'no') return false
  if (lower === 'true' || lower === 'on' || lower === 'yes') return true
  if (/^\d+$/.test(v)) {
    const n = Number(v)
    return n === 0 ? false : n
  }
  return v
}
