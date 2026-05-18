import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi, type User } from '../api/auth'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  isHydrated: boolean

  /** Загрузка сохранённой сессии из AsyncStorage при старте */
  hydrate: () => Promise<void>
  /** Логин по email или phone */
  login: (creds: { email?: string; phone?: string; password: string }) => Promise<void>
  /** Выход */
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const [t, u] = await Promise.all([
        AsyncStorage.getItem('kg_token'),
        AsyncStorage.getItem('kg_user'),
      ])
      if (t && u) {
        set({ token: t, user: JSON.parse(u), isHydrated: true })
      } else {
        set({ isHydrated: true })
      }
    } catch {
      set({ isHydrated: true })
    }
  },

  login: async (creds) => {
    set({ loading: true })
    try {
      const res = await authApi.login(creds)
      await AsyncStorage.setItem('kg_token', res.accessToken)
      await AsyncStorage.setItem('kg_user', JSON.stringify(res.user))
      set({ user: res.user, token: res.accessToken, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore — even if request fails, clear local
    }
    await AsyncStorage.multiRemove(['kg_token', 'kg_user'])
    set({ user: null, token: null })
  },
}))
