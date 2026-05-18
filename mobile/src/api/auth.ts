import { http } from './http'

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'teacher' | 'admin' | 'parent'

export type InstitutionType = 'KINDERGARTEN' | 'SCHOOL'

export interface InstitutionDto {
  id: string
  name: string
  type: InstitutionType
  latitude: number | null
  longitude: number | null
  checkInRadiusMeters: number
}

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
  /** Заполняется только в ответе /auth/me, не в login (для обратной совместимости) */
  institution?: InstitutionDto | null
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

  updateMyInstitution: (dto: {
    name?: string
    address?: string
    phone?: string
    type?: InstitutionType
    latitude?: number | null
    longitude?: number | null
    checkInRadiusMeters?: number
  }) =>
    http
      .patch<InstitutionDto>('/v1/kindergartens/mine', dto)
      .then((r) => r.data),
}
