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

http.interceptors.response.use(
  (response) => {
    const meta = (response.config as ConfigWithMetadata).metadata
    if (meta) {
      meta.logEntry.status = response.status
      meta.logEntry.duration = Date.now() - meta.timestamp
      requestLog.push(meta.logEntry)
    }
    return response
  },
  (error) => {
    const config = error.config as ConfigWithMetadata
    const meta = config?.metadata
    if (meta) {
      meta.logEntry.status = error.response?.status
      meta.logEntry.error = error.message
      meta.logEntry.duration = Date.now() - meta.timestamp
      requestLog.push(meta.logEntry)
    }

    if (error?.response?.status === 401) {
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
