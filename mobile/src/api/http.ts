import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'https://kin-production-b330.up.railway.app/api'

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
})

/**
 * Колбэк, вызываемый при 401 (протух/невалиден токен). authStore
 * регистрирует здесь сброс сессии, чтобы навигация увела на экран логина.
 */
let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn
}

http.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('kg_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => {
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
    if (error?.response?.status === 401) {
      // Токен протух/невалиден — чистим хранилище и уводим на логин.
      // Эндпоинты логина исключаем, чтобы неверный пароль не «выкидывал».
      const url: string = error?.config?.url ?? ''
      if (!url.includes('/auth/login')) {
        await AsyncStorage.removeItem('kg_token')
        await AsyncStorage.removeItem('kg_user')
        unauthorizedHandler?.()
      }
    }
    return Promise.reject(error)
  },
)
