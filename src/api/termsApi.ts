import { http } from './http'

export type TermType = 'QUARTER' | 'TRIMESTER' | 'SEMESTER'

export interface TermDto {
  id: string
  name: string
  type: TermType
  startDate: string
  endDate: string
}

export const termsApi = {
  list: () => http.get<TermDto[]>('/v1/terms').then((r) => r.data),
  current: () =>
    http.get<TermDto | null>('/v1/terms/current').then((r) => r.data),
  create: (dto: {
    name: string
    type?: TermType
    startDate: string
    endDate: string
  }) => http.post<TermDto>('/v1/terms', dto).then((r) => r.data),
  update: (
    id: string,
    dto: {
      name?: string
      type?: TermType
      startDate?: string
      endDate?: string
    },
  ) => http.patch<TermDto>(`/v1/terms/${id}`, dto).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/terms/${id}`).then((r) => r.data),
}
