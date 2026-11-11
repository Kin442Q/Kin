import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi, type LoginResponse, type User } from '../api/auth'
import { REFRESH_KEY, TOKEN_KEY, USER_KEY, setTokenRefreshedHandler, setUnauthorizedHandler } from '../api/http'
import { disconnectSocket } from '../lib/socket'
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
  login: (creds: { email?: string; phone?: string; login?: string; password: string }) => Promise<void>
  /** Вход ученика по личной ссылке (токен — хвост ссылки после /s/) */
  loginWithLink: (token: string) => Promise<void>
  /** Смена своего пароля: новая сессия, флаг «сменить пароль» снят */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /** Перечитать /auth/me и обновить локальный кэш (для актуальной institution.type и пр.) */
  refreshMe: () => Promise<void>
  /** Выход */
  logout: () => Promise<void>
}

/**
 * Общее для обоих входов (пароль и личная ссылка): сохранить токен, дотянуть /me
 * ради institution и разделов школы, записать пользователя, зарегистрировать push.
 */
async function startSession(
  res: LoginResponse,
  set: (patch: Partial<AuthState>) => void,
) {
  await AsyncStorage.setItem(TOKEN_KEY, res.accessToken)
  // Refresh-токен: по нему сессия продлевается без повторного ввода пароля (30 дней)
  if (res.refreshToken) await AsyncStorage.setItem(REFRESH_KEY, res.refreshToken)
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
      await startSession(await authApi.login(creds), set)
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  loginWithLink: async (token) => {
    set({ loading: true })
    try {
      await startSession(await authApi.studentLink(token), set)
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await authApi.changePassword({ currentPassword, newPassword })
    await AsyncStorage.setItem(TOKEN_KEY, res.accessToken)
    // Смена пароля отзывает все старые refresh-токены: сохраняем новый, иначе сессия оборвётся при продлении
    if (res.refreshToken) await AsyncStorage.setItem(REFRESH_KEY, res.refreshToken)
    const user = useAuthStore.getState().user
    if (user) {
      const next = { ...user, mustChangePassword: false }
      await AsyncStorage.setItem('kg_user', JSON.stringify(next))
      set({ user: next, token: res.accessToken })
    } else {
      set({ token: res.accessToken })
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
    disconnectSocket()
    try {
      await authApi.logout(await AsyncStorage.getItem(REFRESH_KEY))
    } catch {
      // ignore — even if request fails, clear local
    }
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY])
    set({ user: null, token: null })
  },
}))

// Когда любой запрос вернёт 401 (токен протух) — сбрасываем сессию в сторе,
// и RootNavigator автоматически покажет экран логина.
setUnauthorizedHandler(() => {
  disconnectSocket()
  useAuthStore.setState({ user: null, token: null })
})

// Access-токен обновился: держим его и в сторе
setTokenRefreshedHandler((accessToken) => {
  useAuthStore.setState({ token: accessToken })
})
