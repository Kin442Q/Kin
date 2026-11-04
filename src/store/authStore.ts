import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role, User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  login: (user: User, token?: string) => void
  /** Обновить только access-токен (после авто-рефреша), не трогая пользователя. */
  setToken: (token: string) => void
  /** Обновить данные пользователя НЕ трогая токен (профиль, учреждение и т.п.). */
  updateUser: (patch: Partial<User>) => void
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
}

/**
 * Если сменился пользователь (или это первый логин) — очищаем
 * локальные данные предыдущего садика. Это важно для multi-tenant,
 * чтобы новый владелец не видел чужие данные из localStorage.
 */
function resetTenantData(previousUserId: string | null, newUserId: string) {
  if (previousUserId !== newUserId) {
    // Динамический импорт чтобы избежать циклической зависимости
    import('./dataStore').then(({ useDataStore }) => {
      useDataStore.getState().resetAll()
    })
  }
}

/**
 * Бэкенд отдаёт роль администратора как ADMIN, а интерфейс везде (меню, маршруты,
 * страницы) проверяет 'admin'. Без приведения ADMIN не открывал ни одной страницы.
 */
const normalizeRole = (r: Role): Role => (r === 'ADMIN' ? 'admin' : r)

export function normalizeUser(u: User): User {
  return u.role === 'ADMIN' ? { ...u, role: normalizeRole(u.role) } : u
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (user, token = 'demo-token') => {
        const prev = get().user
        resetTenantData(prev?.id || null, user.id)
        set({ user: normalizeUser(user), token })
      },
      setToken: (token) => set({ token }),
      updateUser: (patch) => {
        const u = get().user
        if (!u) return
        set({ user: normalizeUser({ ...u, ...patch }) })
      },
      logout: () => {
        // При выходе тоже чистим — следующий вход начнётся с чистого листа
        import('./dataStore').then(({ useDataStore }) => {
          useDataStore.getState().resetAll()
        })
        set({ user: null, token: null })
      },
      hasRole: (...roles) => {
        const u = get().user
        if (!u) return false
        // ADMIN и admin — одна и та же роль
        return roles.map(normalizeRole).includes(normalizeRole(u.role))
      },
    }),
    {
      name: 'kg_auth',
      // Старые сессии из localStorage хранят ADMIN — приводим при загрузке.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>
        return { ...current, ...p, user: p.user ? normalizeUser(p.user) : null }
      },
    },
  ),
)
