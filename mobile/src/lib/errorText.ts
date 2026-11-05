/** Что показать человеку, когда запрос не удался: без «AxiosError: Network Error» и прочего технического. */
export interface ErrorInfo {
  /** offline — нет связи или сервер не отвечает; error — всё остальное */
  kind: 'offline' | 'error'
  title: string
  message: string
}

interface AxiosLike {
  code?: string
  message?: string
  response?: { status?: number; data?: { message?: unknown } }
}

const asText = (v: unknown): string | undefined => {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === 'string' && x.trim())
    return typeof first === 'string' ? first.trim() : undefined
  }
  return undefined
}

/**
 * Превращает ошибку запроса в понятный текст. `fallback` — что сказать, если сервер ничего
 * внятного не ответил (ошибки проверки данных он описывает сам, и это показываем как есть).
 */
export function describeError(error: unknown, fallback?: string): ErrorInfo {
  const e = (error ?? {}) as AxiosLike
  const status = e.response?.status

  if (!e.response) {
    const text = `${e.code ?? ''} ${e.message ?? ''}`.toLowerCase()
    if (text.includes('timeout') || text.includes('econnaborted')) {
      return {
        kind: 'offline',
        title: 'Сервер долго не отвечает',
        message: 'Попробуйте ещё раз через минуту.',
      }
    }
    if (text.includes('network') || text.includes('err_network') || e.code === undefined) {
      return {
        kind: 'offline',
        title: 'Нет связи с сервером',
        message: 'Проверьте интернет и попробуйте ещё раз. Если интернет работает, сервер временно недоступен.',
      }
    }
  }

  const server = asText(e.response?.data?.message)
  if (status === 401) return { kind: 'error', title: 'Нужно войти заново', message: 'Сессия закончилась. Войдите снова.' }
  if (status === 403) {
    return { kind: 'error', title: 'Нет доступа', message: server ?? 'У вас нет прав на это действие.' }
  }
  if (status === 429) {
    return { kind: 'error', title: 'Слишком часто', message: 'Подождите минуту и повторите.' }
  }
  if (status !== undefined && status >= 500) {
    return {
      kind: 'error',
      title: 'Сервер не справился',
      message: 'Что-то пошло не так на нашей стороне. Попробуйте чуть позже.',
    }
  }
  return {
    kind: 'error',
    title: 'Не получилось',
    message: server ?? fallback ?? 'Проверьте данные и попробуйте ещё раз.',
  }
}
