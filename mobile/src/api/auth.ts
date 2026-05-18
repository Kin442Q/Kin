import { http } from './http'

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'teacher' | 'admin' | 'parent'

export interface User {
  id: string
  email: string
  fullName: string
  role: Role
  kindergartenId: string | null
  groupId?: string | null
  childId?: string | null
  avatarUrl?: string | null
  phone?: string | null
}

export interface LoginResponse {
  user: User
  accessToken: string
}

export const authApi = {
  login: (creds: { email?: string; phone?: string; password: string }) =>
    http.post<LoginResponse>('/v1/auth/login', creds).then((r) => r.data),

  me: () => http.get<User>('/v1/auth/me').then((r) => r.data),

  logout: () => http.post('/v1/auth/logout', {}).then((r) => r.data),
}
