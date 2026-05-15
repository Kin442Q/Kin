import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role, User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  login: (user: User, token?: string) => void
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (user, token = 'demo-token') => {
        const prev = get().user
        resetTenantData(prev?.id || null, user.id)
        set({ user, token })
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
        return roles.includes(u.role)
      },
    }),
    { name: 'kg_auth' },
  ),
)
