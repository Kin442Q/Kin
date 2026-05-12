import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const baseURL = (import.meta.env.VITE_API_URL as string) || '/api'

/**
 * Базовый axios-инстанс. Автоматически добавляет Bearer-токен из стора
 * авторизации и обрабатывает 401 (разлогинивает пользователя).
 */
export const http = axios.create({
  baseURL,
  timeout: 15_000,
})

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  },
)
