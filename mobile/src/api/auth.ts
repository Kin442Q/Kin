import { http } from './http'

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'TEACHER'
  | 'PARENT'
  | 'STUDENT'
  | 'teacher'
  | 'admin'
  | 'parent'

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
  /** Включённые разделы учреждения (ключи из lib/features.ts). Есть в /auth/me. */
  features?: string[]
  /** Классы, где пользователь — классный руководитель. Есть в /auth/me. */
  homeroomGroups?: Array<{ id: string; name: string }>
  /** true — вошли по временному паролю от админа: пароль нужно сменить сразу. */
  mustChangePassword?: boolean
}

export interface LoginResponse {
  user: User
  accessToken: string
}

export const authApi = {
  login: (creds: { email?: string; phone?: string; login?: string; password: string }) =>
    http.post<LoginResponse>('/v1/auth/login', creds).then((r) => r.data),

  /** Вход ученика по личной ссылке от классного руководителя (токен — хвост ссылки после /s/). */
  studentLink: (token: string) =>
    http.post<LoginResponse>('/v1/auth/student-link', { token }).then((r) => r.data),

  /**
   * «Забыли пароль»: на email аккаунта уходит ссылка для нового пароля. Ответ всегда одинаковый —
   * сервер не раскрывает, есть ли такой аккаунт.
   */
  forgotPassword: (login: { email?: string; phone?: string }) =>
    http.post<{ ok: boolean; message: string }>('/v1/auth/forgot-password', login).then((r) => r.data),

  /** Сменить свой пароль. Остальные устройства выходят, это остаётся с новой сессией. */
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    http.post<{ accessToken: string }>('/v1/auth/change-password', body).then((r) => r.data),

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
