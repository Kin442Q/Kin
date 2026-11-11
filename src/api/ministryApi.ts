import { http } from './http'
import type { AccessGrant } from './accessApi'
import type { RegionNode } from './regionsApi'

/* ============================================================
   Кабинет министерства образования и районных отделов.
   Только сводные цифры по школам охвата: имён учеников и отдельных
   оценок здесь нет ни в одном ответе.
   ============================================================ */

export interface GeoName {
  id: string
  nameRu: string
  nameTg: string
  nameEn: string
}

/** Показатели за период; null — данных нет (школа не заполнила журнал), это не «ноль». */
export interface Metrics {
  gradesCount: number
  /** Средняя оценка в % от максимума шкалы школы (5 или 10) — сравнима между школами. */
  avgPercent: number | null
  /** Доля оценок «хорошо» и «отлично», %. */
  quality: number | null
  /** Доля оценок не ниже удовлетворительной, %. */
  success: number | null
  attendanceMarks: number
  attendanceRate: number | null
  illnessRate: number | null
}

export interface Rollup extends Metrics {
  schools: number
  students: number
  teachers: number
  classes: number
  studentsPerTeacher: number | null
  schoolsWithGrades: number
  schoolsWithAttendance: number
}

export interface SchoolRow extends Metrics {
  id: string
  name: string
  gradeScale: 'FIVE' | 'TEN'
  region: GeoName | null
  district: GeoName | null
  latitude: number | null
  longitude: number | null
  students: number
  teachers: number
  classes: number
  studentsPerTeacher: number | null
  rank: number | null
  flags: { noGrades: boolean; noAttendance: boolean; noTeachers: boolean; noLocation: boolean }
}

export interface MinistryQuery {
  regionId?: string
  districtId?: string
  /** YYYY-MM-DD */
  from?: string
  to?: string
  q?: string
}

export interface Period {
  from: string
  to: string
}

export interface MinistryFilters {
  organization: string
  allSchools: boolean
  regions: RegionNode[]
}

export interface MinistryOverview {
  period: Period
  total: Rollup
  regions: Array<Rollup & { region: GeoName | null }>
  attention: Array<{ id: string; name: string; district: GeoName | null; region: GeoName | null; avgPercent: number | null; quality: number | null }>
  noData: { grades: number; attendance: number; teachers: number }
}

export type DistrictRow = Rollup & { district: GeoName | null; region: GeoName | null }

/** Наблюдатель: учётная запись министерства или районного отдела. */
export interface Viewer {
  id: string
  email: string
  fullName: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  organization: string | null
  allSchools: boolean
  regions: GeoName[]
  districts: Array<GeoName & { regionId: string }>
}

export interface CreateViewerBody {
  fullName: string
  email: string
  organization: string
  allSchools: boolean
  regionIds: string[]
  districtIds: string[]
}

/** Пустые значения в запрос не попадают. */
function params(query: MinistryQuery): Record<string, string> {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>
}

export const ministryApi = {
  filters: () => http.get<MinistryFilters>('/v1/ministry/filters').then((r) => r.data),
  overview: (query: MinistryQuery) => http.get<MinistryOverview>('/v1/ministry/overview', { params: params(query) }).then((r) => r.data),
  schools: (query: MinistryQuery) =>
    http.get<{ period: Period; schools: SchoolRow[] }>('/v1/ministry/schools', { params: params(query) }).then((r) => r.data),
  districts: (query: MinistryQuery) =>
    http.get<{ period: Period; districts: DistrictRow[] }>('/v1/ministry/districts', { params: params(query) }).then((r) => r.data),

  // Учётные записи наблюдателей — только владелец платформы.
  viewers: () => http.get<Viewer[]>('/v1/ministry/viewers').then((r) => r.data),
  createViewer: (body: CreateViewerBody) =>
    http.post<{ viewer: Viewer; invite: AccessGrant }>('/v1/ministry/viewers', body).then((r) => r.data),
  updateViewer: (id: string, body: Partial<Omit<CreateViewerBody, 'email'>> & { isActive?: boolean }) =>
    http.patch<Viewer>(`/v1/ministry/viewers/${id}`, body).then((r) => r.data),
  resendInvite: (id: string) => http.post<AccessGrant>(`/v1/ministry/viewers/${id}/invite`).then((r) => r.data),
}
