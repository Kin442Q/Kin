import { http } from './http'

export interface StudentDto {
  id: string
  firstName: string
  lastName: string
  photoUrl: string | null
  groupId: string | null
  status: 'ACTIVE' | 'ARCHIVED' | 'WAITLIST'
  group?: { id: string; name: string; color: string | null } | null
}

export const studentsApi = {
  list: (params: { groupId?: string; status?: string } = {}) =>
    http
      .get<StudentDto[]>('/v1/students', { params })
      .then((r) => r.data),
}
