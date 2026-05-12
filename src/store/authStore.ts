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
 * Хранилище авторизации. В продакшен-интеграции токен приходит из
 * backend /auth/login. В демо-режиме (без backend) login принимает
 * заранее сформированного пользователя из mock-данных.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (user, token = 'demo-token') => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      hasRole: (...roles) => {
        const u = get().user
        if (!u) return false
        return roles.includes(u.role)
      },
    }),
    { name: 'kg_auth' },
  ),
)
