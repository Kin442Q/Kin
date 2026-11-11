import { uiText } from '../i18n/uiText'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL } from '../lib/config'

export const TOKEN_KEY = 'kg_token'
export const REFRESH_KEY = 'kg_refresh'
export const USER_KEY = 'kg_user'

export const http = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
})

/**
 * Колбэк, вызываемый, когда сессию не удалось продлить (refresh-токен недействителен или его нет).
 * authStore регистрирует здесь сброс сессии, чтобы навигация увела на экран логина.
 */
let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn
}

/** Колбэк «access-токен обновился»: например, переподключить сокет с новым токеном. */
let tokenRefreshedHandler: ((accessToken: string) => void) | null = null
export function setTokenRefreshedHandler(fn: (accessToken: string) => void) {
  tokenRefreshedHandler = fn
}

/** Бекенд оборачивает ответы в { data: ... } через TransformInterceptor. */
function unwrap<T>(body: unknown): T {
  if (
    body &&
    typeof body === 'object' &&
    'data' in body &&
    Object.keys(body).every((k) => k === 'data' || k === 'meta')
  ) {
    return (body as { data: T }).data
  }
  return body as T
}

http.interceptors.request.use(async (config) => {
  // Сервер по этому заголовку отдаёт приложению refresh-токен в теле ответа (cookie оно не хранит)
  config.headers['X-Client'] = 'mobile'
  const token = await AsyncStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type RefreshResult =
  | { kind: 'ok'; accessToken: string; refreshToken: string }
  /** Сервер отказал: refresh-токен недействителен — сессию не продлить, нужен вход. */
  | { kind: 'rejected' }
  /** Нет связи или сервер недоступен: сессию не трогаем, повторим позже. */
  | { kind: 'offline'; error: unknown }

async function doRefresh(): Promise<RefreshResult> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return { kind: 'rejected' }
  try {
    // Чистый axios без наших перехватчиков: сам запрос продления не должен продлевать себя
    const res = await axios.post(
      `${API_URL}/v1/auth/refresh`,
      { refreshToken },
      { timeout: 15_000, headers: { 'X-Client': 'mobile' } },
    )
    const body = unwrap<{ accessToken?: string; refreshToken?: string }>(res.data)
    if (!body?.accessToken || !body?.refreshToken) return { kind: 'rejected' }
    // Токен одноразовый (ротация): новый refresh-токен сохраняем сразу, иначе следующее продление не пройдёт
    await AsyncStorage.multiSet([
      [TOKEN_KEY, body.accessToken],
      [REFRESH_KEY, body.refreshToken],
    ])
    tokenRefreshedHandler?.(body.accessToken)
    return { kind: 'ok', accessToken: body.accessToken, refreshToken: body.refreshToken }
  } catch (e) {
    const status = (e as AxiosError)?.response?.status
    if (status === 401 || status === 403) return { kind: 'rejected' }
    return { kind: 'offline', error: e }
  }
}

let refreshing: Promise<RefreshResult> | null = null

/**
 * Продлить сессию. Параллельные запросы, получившие 401 одновременно, ждут один общий запрос:
 * refresh-токен одноразовый: второй запрос с уже использованным токеном сервер отклонит, и человека выкинуло бы на вход.
 */
export function refreshSession(): Promise<RefreshResult> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

/** Эндпоинты входа и продления: 401 на них не «выкидывает» (неверный пароль, мёртвая ссылка). */
const isAuthUrl = (url: string) =>
  url.includes('/auth/login') || url.includes('/auth/student-link') || url.includes('/auth/refresh')

http.interceptors.response.use(
  (response) => {
    // Разворачиваем { data: ... }, чтобы вызывающий код видел сразу полезную нагрузку.
    response.data = unwrap(response.data)
    return response
  },
  async (error: AxiosError) => {
    const payload = error.response?.data as { message?: unknown } | undefined
    if (payload && typeof payload.message === 'string') payload.message = uiText(payload.message)
    else if (payload && Array.isArray(payload.message)) payload.message = payload.message.map(value => typeof value === 'string' ? uiText(value) : value)

    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const url = config?.url ?? ''
    if (error.response?.status === 401 && config && !config._retried && !isAuthUrl(url)) {
      // Access-токен (15 минут) протух: продлеваем сессию refresh-токеном и повторяем запрос один раз.
      const r = await refreshSession()
      if (r.kind === 'ok') {
        config._retried = true
        config.headers.Authorization = `Bearer ${r.accessToken}`
        // При выходе серверу нужен именно новый refresh-токен: старый уже отозван продлением
        if (url.includes('/auth/logout')) config.data = JSON.stringify({ refreshToken: r.refreshToken })
        return http(config)
      }
      if (r.kind === 'offline') {
        // Продлить не удалось из-за сети: это ошибка связи, а не «нужно войти заново»
        return Promise.reject(r.error)
      }
      // Сервер отказал в продлении — сессия закончилась: чистим хранилище и уводим на логин
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY])
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  },
)
