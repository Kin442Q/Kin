import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi, type User } from '../api/auth'
import { setUnauthorizedHandler } from '../api/http'
import {
  registerForPushNotificationsAsync,
  registerPushTokenOnServer,
  unregisterPushTokenOnServer,
} from '../lib/push'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  isHydrated: boolean

  /** Загрузка сохранённой сессии из AsyncStorage при старте */
  hydrate: () => Promise<void>
  /** Логин по email или phone */
  login: (creds: { email?: string; phone?: string; password: string }) => Promise<void>
  /** Перечитать /auth/me и обновить локальный кэш (для актуальной institution.type и пр.) */
  refreshMe: () => Promise<void>
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
        const parsed: User = JSON.parse(u)
        set({ token: t, user: parsed, isHydrated: true })
        // Фоном перепроверим что institution.type актуален — не блокируем UI.
        authApi
          .me()
          .then(async (me) => {
            await AsyncStorage.setItem('kg_user', JSON.stringify(me))
            set({ user: me })
          })
          .catch(() => {})
        // И обновим push token (может смениться при переустановке)
        registerForPushNotificationsAsync()
          .then((tok) => (tok ? registerPushTokenOnServer(tok) : undefined))
          .catch(() => {})
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
      // Сразу после логина дотягиваем /me чтобы получить institution.type
      let user: User = res.user
      try {
        const me = await authApi.me()
        user = me
      } catch {
        // если /me временно недоступен — используем то что пришло с логина
      }
      await AsyncStorage.setItem('kg_user', JSON.stringify(user))
      set({ user, token: res.accessToken, loading: false })

      // Регистрируем Expo push token на бэкенде (без блокировки UI)
      registerForPushNotificationsAsync()
        .then((t) => (t ? registerPushTokenOnServer(t) : undefined))
        .catch(() => {})
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  refreshMe: async () => {
    try {
      const me = await authApi.me()
      await AsyncStorage.setItem('kg_user', JSON.stringify(me))
      set({ user: me })
    } catch {
      // ignore — не критично
    }
  },

  logout: async () => {
    // Снимаем push-токен на бэкенде — чтобы не получать уведомления
    // после выхода из аккаунта.
    await unregisterPushTokenOnServer().catch(() => {})
    try {
      await authApi.logout()
    } catch {
      // ignore — even if request fails, clear local
    }
    await AsyncStorage.multiRemove(['kg_token', 'kg_user'])
    set({ user: null, token: null })
  },
}))

// Когда любой запрос вернёт 401 (токен протух) — сбрасываем сессию в сторе,
// и RootNavigator автоматически покажет экран логина.
setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null, token: null })
})
