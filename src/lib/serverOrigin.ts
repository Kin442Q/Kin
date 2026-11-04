/**
 * Адрес сервера без «/api» — для ссылок, которые показываем пользователю
 * (например, webhook терминала). Берётся из VITE_API_URL, чтобы при смене
 * сервера на Railway не править код; в разработке (относительный «/api»)
 * это адрес самого сайта.
 */
export function serverOrigin(): string {
  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
  if (/^https?:\/\//i.test(api)) return api.replace(/\/+$/, '').replace(/\/api$/, '')
  return window.location.origin
}
