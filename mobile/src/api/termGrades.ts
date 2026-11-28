import { http } from './http'

/* ============================================================
   Итоги четвертей. Итог — оценка учителя (TEACHER), а без неё
   расчётная по среднему баллу (SYSTEM). Расчёт делает сервер.
   Зеркало web/src/api/termGradesApi.ts.
   ============================================================ */

export type TermGradeSource = 'TEACHER' | 'SYSTEM'

export interface CalculatedTermGrade {
  /** null — посчитать нельзя (см. reason). */
  value: number | null
  average: number | null
  count: number
  asOf: string | null
  reason: 'NO_GRADES' | 'OUT_OF_SCALE' | null
}

export interface TermGradeItem {
  studentId: string
  /** Действующий итог; null — нет ни оценки учителя, ни расчёта. */
  value: number | null
  source: TermGradeSource | null
  /** TEACHER — когда поставлен; SYSTEM — по какую дату есть оценки. */
  date: string | null
  manual: { value: number; setAt: string; setBy: { id: string; fullName: string } | null } | null
  calculated: CalculatedTermGrade
}

export interface ClassTermGrades {
  /** Максимальная оценка по шкале школы: 5 или 10. */
  scaleMax: number
  items: TermGradeItem[]
}

export interface TermGradeKey {
  termId: string
  subjectId: string
  studentId: string
}

/** Итоги одного ученика — для него самого и родителя. */
export interface StudentTermReport {
  scaleMax: number
  terms: Array<{
    id: string
    name: string
    startDate: string
    endDate: string
    finished: boolean
    subjects: Array<{
      subject: { id: string; name: string; color: string }
      value: number
      source: TermGradeSource
      date: string
      average: number | null
      count: number
    }>
  }>
}

export const termGradesApi = {
  list: (params: { termId: string; subjectId: string; groupId: string }) =>
    http.get<ClassTermGrades>('/v1/term-grades', { params }).then((r) => r.data),
  set: (dto: TermGradeKey & { value: number }) =>
    http.put<{ scaleMax: number; item: TermGradeItem }>('/v1/term-grades', dto).then((r) => r.data),
  /** Убрать оценку учителя: снова действует расчётная. */
  reset: (params: TermGradeKey) =>
    http
      .delete<{ scaleMax: number; item: TermGradeItem }>('/v1/term-grades', { params })
      .then((r) => r.data),
}
