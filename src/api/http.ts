import axios, { AxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

const baseURL = (import.meta.env.VITE_API_URL as string) || '/api'

interface ConfigWithMetadata extends AxiosRequestConfig {
  metadata?: {
    requestId: number
    timestamp: number
    logEntry: any
  }
}

export const http = axios.create({
  baseURL,
  timeout: 15_000,
  // Нужно, чтобы браузер хранил/слал httpOnly refresh-cookie при логине
  // и авто-рефреше токена (CORS с credentials).
  withCredentials: true,
})

let requestCounter = 0
const requestLog: Array<{
  id: number
  method: string
  url: string
  timestamp: number
  status?: number
  duration?: number
  error?: string
}> = []

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const requestId = ++requestCounter
  const timestamp = Date.now()
  const logEntry = {
    id: requestId,
    method: config.method?.toUpperCase() || 'GET',
    url: config.url || '',
    timestamp,
  }

  ;(config as ConfigWithMetadata).metadata = { requestId, timestamp, logEntry }
  return config
})

// ─── Авто-рефреш access-токена ────────────────────────────────────────
// Access-токен живёт ~15 мин. Когда он истекает во время работы, запрос
// получает 401 — мы один раз обновляем токен по refresh-cookie и повторяем
// исходный запрос. Параллельные 401 ждут один общий refresh.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  try {
    // Сырой axios (без наших интерсепторов) — чтобы не зациклиться.
    const resp = await axios.post(
      `${baseURL}/v1/auth/refresh`,
      {},
      { withCredentials: true, timeout: 15_000 },
    )
    const payload = (resp.data?.data ?? resp.data) as
      | { accessToken?: string }
      | undefined
    const token = payload?.accessToken ?? null
    if (token) useAuthStore.getState().setToken(token)
    return token
  } catch {
    return null
  }
}

http.interceptors.response.use(
  (response) => {
    const meta = (response.config as ConfigWithMetadata).metadata
    if (meta) {
      meta.logEntry.status = response.status
      meta.logEntry.duration = Date.now() - meta.timestamp
      requestLog.push(meta.logEntry)
    }

    // Бекенд оборачивает ответы в { data: ... } через TransformInterceptor.
    // Разворачиваем здесь, чтобы вызывающий код видел сразу полезную нагрузку.
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      Object.keys(response.data).every((k) => k === 'data' || k === 'meta')
    ) {
      response.data = (response.data as { data: unknown }).data
    }
    return response
  },
  async (error) => {
    const config = error.config as
      | (ConfigWithMetadata & { _retry?: boolean })
      | undefined
    const meta = config?.metadata
    if (meta) {
      meta.logEntry.status = error.response?.status
      meta.logEntry.error = error.message
      meta.logEntry.duration = Date.now() - meta.timestamp
      requestLog.push(meta.logEntry)
    }

    const status = error?.response?.status
    const url = config?.url || ''
    const isAuthCall =
      url.includes('/auth/login') || url.includes('/auth/refresh')

    // 401 во время работы → пробуем обновить токен и повторить запрос один раз.
    if (
      status === 401 &&
      config &&
      !config._retry &&
      !isAuthCall &&
      useAuthStore.getState().token
    ) {
      config._retry = true
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      if (newToken) {
        config.headers = config.headers || {}
        ;(config.headers as Record<string, string>).Authorization = `Bearer ${newToken}`
        return http(config)
      }
      // Обновить не удалось — выходим.
      useAuthStore.getState().logout()
      return Promise.reject(error)
    }

    if (status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)

export const getRequestDiagnostics = () => {
  const last20 = requestLog.slice(-20)
  return {
    totalRequests: requestLog.length,
    errors: requestLog.filter((r) => r.error).length,
    avgDuration: Math.round(
      requestLog.reduce((sum, r) => sum + (r.duration || 0), 0) / requestLog.length,
    ),
    lastRequests: last20,
  }
}
