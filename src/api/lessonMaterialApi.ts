import { http } from './http'
import { uploadFile, type FileLink, type StoredFileView } from './filesApi'

/* ============================================================
   Материалы к уроку: учитель выкладывает классу файл, ссылку или текст.
   Живут 30 дней, потом сервер удаляет запись и файл сам.
   ============================================================ */

export const LESSON_MATERIAL_TTL_DAYS = 30

export interface LessonMaterial {
  id: string
  title: string
  description: string | null
  url: string | null
  createdAt: string
  expiresAt: string
  /** Сколько дней осталось до автоматического удаления. */
  daysLeft: number
  subject: { id: string; name: string; color: string } | null
  group: { id: string; name: string }
  author: { id: string; fullName: string } | null
  file: StoredFileView | null
}

export interface LessonMaterialInput {
  groupId: string
  subjectId?: string | null
  title: string
  description?: string | null
  url?: string | null
  fileId?: string | null
}

export const lessonMaterialApi = {
  list: (params?: { groupId?: string; subjectId?: string }) =>
    http.get<LessonMaterial[]>('/v1/lesson-materials', { params }).then((r) => r.data),
  create: (body: LessonMaterialInput) =>
    http.post<LessonMaterial>('/v1/lesson-materials', body).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/lesson-materials/${id}`),
  fileLink: (id: string) => http.get<FileLink>(`/v1/lesson-materials/${id}/file-link`).then((r) => r.data),
  upload: (file: File, onProgress?: (percent: number) => void) =>
    uploadFile('/v1/lesson-materials/upload', file, onProgress),
}

/** «день / дня / дней» по числу. */
export function daysWord(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'день'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня'
  return 'дней'
}

/** Подпись срока: «удалится сегодня / завтра / через 5 дней». */
export function expiryText(daysLeft: number): string {
  if (daysLeft <= 0) return 'удалится сегодня'
  if (daysLeft === 1) return 'удалится завтра'
  return `удалится через ${daysLeft} ${daysWord(daysLeft)}`
}

export interface MaterialFormValues {
  groupId: string
  subjectId?: string | null
  title: string
  description?: string | null
  url?: string | null
  file?: StoredFileView | null
}

/**
 * Из значений формы — тело запроса. Нужен хотя бы файл, ссылка или текст
 * (иначе ученикам нечего открыть); пустые строки не отправляем.
 */
export function buildMaterialInput(v: MaterialFormValues): { body: LessonMaterialInput } | { error: string } {
  const description = v.description?.trim() || null
  const url = v.url?.trim() || null
  if (!description && !url && !v.file) {
    return { error: 'Добавьте файл, ссылку или текст — иначе ученикам нечего открыть' }
  }
  return {
    body: {
      groupId: v.groupId,
      subjectId: v.subjectId || null,
      title: v.title.trim(),
      description,
      url,
      fileId: v.file?.id ?? null,
    },
  }
}
