import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'https://kin-production-b330.up.railway.app/api'

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
})

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
      await AsyncStorage.removeItem('kg_token')
      await AsyncStorage.removeItem('kg_user')
    }
    return Promise.reject(error)
  },
)
