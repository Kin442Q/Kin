import { http } from './http'
import type { EducationReport } from '../../server/src/modules/director-reports/report'
export type { EducationReport }
export interface ReportFilters {
  from: string
  to: string
  groupId?: string
  scale: 'unset' | 'five' | 'ten'
  pass?: number
  quality?: number
  excellent?: number
}
export const directorReportsApi = {
  overview: (params: ReportFilters, signal?: AbortSignal) =>
    http.get<EducationReport>('/v1/director-reports/overview', { params, signal }).then(response => response.data),
  export: (params: ReportFilters, format: 'XLSX'|'PDF') =>
    http.post<EducationReport>('/v1/director-reports/export', {...params,format}).then(response=>response.data),
}
