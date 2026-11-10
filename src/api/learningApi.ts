import { uiText } from '../i18n/uiText'
import { http } from './http'

/* ============================================================
   Библиотека, квизы, подготовка к экзаменам, игры (этап 3).
   Ответы бэкенда распаковываются интерцептором http.
   ============================================================ */

// ─── Библиотека ───────────────────────────────────────────────

export type LibraryType = 'BOOK' | 'ARTICLE' | 'VIDEO' | 'AUDIO' | 'LINK'

export const LIBRARY_TYPES: Array<{ value: LibraryType; label: string; emoji: string }> = [
  { value: 'BOOK', get label() { return uiText("Книга") }, emoji: '📚' },
  { value: 'ARTICLE', get label() { return uiText("Статья") }, emoji: '📰' },
  { value: 'VIDEO', get label() { return uiText("Видео") }, emoji: '🎬' },
  { value: 'AUDIO', get label() { return uiText("Аудио") }, emoji: '🎧' },
  { value: 'LINK', get label() { return uiText("Ссылка") }, emoji: '🔗' },
]

export const libraryTypeInfo = (t: LibraryType) =>
  LIBRARY_TYPES.find((x) => x.value === t) ?? LIBRARY_TYPES[LIBRARY_TYPES.length - 1]

export interface LibraryItem {
  id: string
  title: string
  description: string | null
  type: LibraryType
  url: string
  subjectId: string | null
  gradeNumber: number | null
  authorId: string | null
  createdAt: string
  subject?: { id: string; name: string; color: string } | null
  author?: { id: string; fullName: string } | null
}

export interface LibraryInput {
  title: string
  description?: string | null
  type: LibraryType
  url: string
  subjectId?: string | null
  gradeNumber?: number | null
}

export const libraryApi = {
  list: (params?: { type?: LibraryType; subjectId?: string; gradeNumber?: number; q?: string }) =>
    http.get<LibraryItem[]>('/v1/library', { params }).then((r) => r.data),
  create: (body: LibraryInput) => http.post<LibraryItem>('/v1/library', body).then((r) => r.data),
  update: (id: string, body: Partial<LibraryInput>) =>
    http.patch<LibraryItem>(`/v1/library/${id}`, body).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/library/${id}`),
}

// ─── Квизы ────────────────────────────────────────────────────

export type QuestionKind = 'SINGLE' | 'MULTIPLE'

export interface QuizOption {
  text: string
  correct: boolean
}

export interface QuizQuestionInput {
  text: string
  kind: QuestionKind
  options: QuizOption[]
  explanation?: string | null
}

export interface QuizBest {
  score: number
  total: number
  percent: number
  attempts: number
}

export interface QuizSummary {
  id: string
  title: string
  description: string | null
  isPublished: boolean
  timeLimitSec: number | null
  subjectId: string | null
  examTrackId: string | null
  createdAt: string
  authorId: string | null
  subject?: { id: string; name: string; color: string } | null
  examTrack?: { id: string; name: string } | null
  author?: { id: string; fullName: string } | null
  questionsCount: number
  /** Только для сотрудников. */
  attemptsCount?: number
  /** Только для ученика: его лучший результат (null — не проходил). */
  myBest?: QuizBest | null
}

export interface QuizInput {
  title: string
  description?: string | null
  subjectId?: string | null
  examTrackId?: string | null
  timeLimitSec?: number | null
  isPublished?: boolean
  questions: QuizQuestionInput[]
}

export interface QuizForEdit extends Omit<QuizSummary, 'questionsCount'> {
  questions: Array<QuizQuestionInput & { id: string; position: number }>
}

export interface PlayQuestion {
  id: string
  position: number
  text: string
  kind: QuestionKind
  options: Array<{ text: string }>
}

export interface PlayQuiz {
  id: string
  title: string
  description: string | null
  timeLimitSec: number | null
  questions: PlayQuestion[]
}

export interface ReviewItem {
  questionId: string
  correct: boolean
  selected: number[]
  correctOptions: number[]
  explanation: string | null
}

export interface AttemptResult {
  attemptId: string
  createdAt: string
  score: number
  total: number
  percent: number
  review: ReviewItem[]
}

export interface QuizResultRow {
  student: { id: string; firstName: string; lastName: string; group: string | null }
  best: QuizBest | null
  lastAt: string
}

export const quizApi = {
  list: (params?: { examTrackId?: string; subjectId?: string }) =>
    http.get<QuizSummary[]>('/v1/quizzes', { params }).then((r) => r.data),
  get: (id: string) => http.get<QuizForEdit>(`/v1/quizzes/${id}`).then((r) => r.data),
  create: (body: QuizInput) => http.post<{ id: string }>('/v1/quizzes', body).then((r) => r.data),
  update: (id: string, body: Partial<QuizInput>) =>
    http.patch<{ id: string }>(`/v1/quizzes/${id}`, body).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/quizzes/${id}`),
  results: (id: string) => http.get<QuizResultRow[]>(`/v1/quizzes/${id}/results`).then((r) => r.data),
  play: (id: string) => http.get<PlayQuiz>(`/v1/quizzes/${id}/play`).then((r) => r.data),
  submit: (id: string, body: { answers: Array<{ questionId: string; selected: number[] }>; durationSec?: number }) =>
    http.post<AttemptResult>(`/v1/quizzes/${id}/attempts`, body).then((r) => r.data),
}

// ─── Подготовка к экзаменам ───────────────────────────────────

export interface ExamTrack {
  id: string
  name: string
  description: string | null
  author?: { id: string; fullName: string } | null
  authorId: string | null
  quizzesCount: number
  /** Только для ученика. */
  progress?: { total: number; attempted: number; avgPercent: number | null }
}

export const examTrackApi = {
  list: () => http.get<ExamTrack[]>('/v1/exam-prep/tracks').then((r) => r.data),
  create: (body: { name: string; description?: string | null }) =>
    http.post<ExamTrack>('/v1/exam-prep/tracks', body).then((r) => r.data),
  update: (id: string, body: { name?: string; description?: string | null }) =>
    http.patch<ExamTrack>(`/v1/exam-prep/tracks/${id}`, body).then((r) => r.data),
  remove: (id: string) => http.delete(`/v1/exam-prep/tracks/${id}`),
}

// ─── Игры ─────────────────────────────────────────────────────

export type GameKey = 'memory' | 'math' | 'sequence'

export interface GameInfo {
  key: GameKey
  title: string
  description: string
  skill: string
  maxScore: number
  myBest?: number | null
}

export interface LeaderRow {
  rank: number
  name: string
  score: number
  isMe: boolean
}

export const gamesApi = {
  list: () => http.get<GameInfo[]>('/v1/games').then((r) => r.data),
  submit: (key: GameKey, body: { score: number; level?: number }) =>
    http.post<{ score: number; best: number; isRecord: boolean }>(`/v1/games/${key}/scores`, body).then((r) => r.data),
  leaderboard: (key: GameKey, groupId?: string) =>
    http.get<LeaderRow[]>(`/v1/games/${key}/leaderboard`, { params: { groupId } }).then((r) => r.data),
}
