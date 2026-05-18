import { http } from './http'

export type Mood = 'HAPPY' | 'NEUTRAL' | 'SAD' | 'SICK'
export type NapQuality = 'GOOD' | 'NORMAL' | 'POOR' | 'NO_NAP'

export interface DiaryEntryDto {
  id: string
  groupId: string
  date: string
  breakfast: string | null
  lunch: string | null
  snack: string | null
  activities: string | null
  note: string | null
  authorId: string
  author?: { id: string; fullName: string }
  createdAt: string
  updatedAt: string
}

export interface KidNoteDto {
  id: string
  studentId: string
  date: string
  mood: Mood | null
  napQuality: NapQuality | null
  note: string | null
  photoUrls: string[]
  authorId: string
  author?: { id: string; fullName: string }
  createdAt: string
  updatedAt: string
  student?: { id: string; firstName: string; lastName: string }
}

export const diaryApi = {
  /** Запись дневника группы на дату — учитель/админ/родитель. */
  groupDiary: (groupId: string, date: string) =>
    http
      .get<DiaryEntryDto | null>(`/v1/diary/group/${groupId}`, {
        params: { date },
      })
      .then((r) => r.data),

  /** Создать/обновить запись группы — учитель/админ. */
  upsertGroupDiary: (payload: {
    groupId: string
    date: string
    breakfast?: string
    lunch?: string
    snack?: string
    activities?: string
    note?: string
  }) =>
    http.post<DiaryEntryDto>('/v1/diary/group', payload).then((r) => r.data),

  /** Заметка про конкретного ребёнка на дату. */
  kidNote: (studentId: string, date: string) =>
    http
      .get<KidNoteDto | null>(`/v1/diary/kid/${studentId}`, {
        params: { date },
      })
      .then((r) => r.data),

  upsertKidNote: (payload: {
    studentId: string
    date: string
    mood?: Mood
    napQuality?: NapQuality
    note?: string
    photoUrls?: string[]
  }) => http.post<KidNoteDto>('/v1/diary/kid', payload).then((r) => r.data),

  /** Все заметки группы на день (учитель/админ). */
  kidNotesForGroup: (groupId: string, date: string) =>
    http
      .get<KidNoteDto[]>(`/v1/diary/group/${groupId}/kids`, {
        params: { date },
      })
      .then((r) => r.data),
}
