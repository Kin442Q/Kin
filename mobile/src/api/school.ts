import { http } from './http'

export type GradeType =
  | 'CLASSWORK'
  | 'HOMEWORK'
  | 'CONTROL'
  | 'EXAM'
  | 'PROJECT'
  | 'OTHER'

export interface SubjectDto {
  id: string
  name: string
  color: string
}

export interface GradeDto {
  id: string
  studentId: string
  subjectId: string
  value: number
  type: GradeType
  date: string
  comment: string | null
  authorId: string
  subject?: { id: string; name: string; color: string }
  student?: { id: string; firstName: string; lastName: string }
  author?: { id: string; fullName: string }
  createdAt: string
}

export interface HomeworkDto {
  id: string
  subjectId: string
  groupId: string
  title: string
  description: string | null
  dueDate: string
  attachments: string[]
  authorId: string
  subject?: { id: string; name: string; color: string }
  group?: { id: string; name: string }
  createdAt: string
}

export interface GradeStatsRow {
  subjectId: string
  name: string
  color: string
  count: number
  sum: number
  average: number
}

export const schoolApi = {
  // Subjects
  listSubjects: () =>
    http.get<SubjectDto[]>('/v1/subjects').then((r) => r.data),
  createSubject: (dto: { name: string; color?: string }) =>
    http.post<SubjectDto>('/v1/subjects', dto).then((r) => r.data),
  updateSubject: (id: string, dto: { name?: string; color?: string }) =>
    http.patch<SubjectDto>(`/v1/subjects/${id}`, dto).then((r) => r.data),
  deleteSubject: (id: string) =>
    http.delete(`/v1/subjects/${id}`).then((r) => r.data),

  // Grades
  listGrades: (params: {
    studentId?: string
    subjectId?: string
    from?: string
    to?: string
  } = {}) => http.get<GradeDto[]>('/v1/grades', { params }).then((r) => r.data),
  createGrade: (dto: {
    studentId: string
    subjectId: string
    value: number
    type?: GradeType
    date: string
    comment?: string
  }) => http.post<GradeDto>('/v1/grades', dto).then((r) => r.data),
  deleteGrade: (id: string) =>
    http.delete(`/v1/grades/${id}`).then((r) => r.data),
  gradeStats: (studentId: string) =>
    http
      .get<GradeStatsRow[]>(`/v1/grades/stats/${studentId}`)
      .then((r) => r.data),

  // Homework
  listHomework: (params: {
    groupId?: string
    subjectId?: string
    from?: string
    to?: string
  } = {}) =>
    http.get<HomeworkDto[]>('/v1/homework', { params }).then((r) => r.data),
  createHomework: (dto: {
    subjectId: string
    groupId: string
    title: string
    description?: string
    dueDate: string
    attachments?: string[]
  }) => http.post<HomeworkDto>('/v1/homework', dto).then((r) => r.data),
  updateHomework: (
    id: string,
    dto: {
      title?: string
      description?: string
      dueDate?: string
      attachments?: string[]
    },
  ) => http.patch<HomeworkDto>(`/v1/homework/${id}`, dto).then((r) => r.data),
  deleteHomework: (id: string) =>
    http.delete(`/v1/homework/${id}`).then((r) => r.data),
}
