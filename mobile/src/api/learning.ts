import { http } from './http'
import type { FileLink, StoredFileView } from './files'

/* ============================================================
   Библиотека, квизы, подготовка к экзаменам и игры (сторона ученика).
   Зеркало web/src/api/learningApi.ts.
   ============================================================ */

// ─── Библиотека ───────────────────────────────────────────────

export type LibraryType = 'BOOK' | 'ARTICLE' | 'VIDEO' | 'AUDIO' | 'LINK'

export const LIBRARY_TYPES: Array<{
  value: LibraryType
  label: string
  emoji: string
}> = [
  { value: 'BOOK', label: 'Книга', emoji: '📚' },
  { value: 'ARTICLE', label: 'Статья', emoji: '📰' },
  { value: 'VIDEO', label: 'Видео', emoji: '🎬' },
  { value: 'AUDIO', label: 'Аудио', emoji: '🎧' },
  { value: 'LINK', label: 'Ссылка', emoji: '🔗' },
]

export const libraryTypeInfo = (t: LibraryType) =>
  LIBRARY_TYPES.find((x) => x.value === t) ?? LIBRARY_TYPES[LIBRARY_TYPES.length - 1]

export interface LibraryItem {
  id: string
  title: string
  description: string | null
  type: LibraryType
  /** Ссылка на материал; null — материал хранится файлом (file). */
  url: string | null
  subjectId: string | null
  gradeNumber: number | null
  subject?: { id: string; name: string; color: string } | null
  author?: { id: string; fullName: string } | null
  file?: StoredFileView | null
}

export const libraryApi = {
  list: (params?: { type?: LibraryType; q?: string }) =>
    http.get<LibraryItem[]>('/v1/library', { params }).then((r) => r.data),
  fileLink: (id: string) => http.get<FileLink>(`/v1/library/${id}/file-link`).then((r) => r.data),
}

// ─── Квизы ────────────────────────────────────────────────────

export type QuestionKind = 'SINGLE' | 'MULTIPLE'

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
  timeLimitSec: number | null
  examTrackId: string | null
  subject?: { id: string; name: string; color: string } | null
  examTrack?: { id: string; name: string } | null
  questionsCount: number
  /** Только для ученика: его лучший результат (null — не проходил). */
  myBest?: QuizBest | null
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

export const quizApi = {
  list: (params?: { examTrackId?: string }) =>
    http.get<QuizSummary[]>('/v1/quizzes', { params }).then((r) => r.data),
  play: (id: string) =>
    http.get<PlayQuiz>(`/v1/quizzes/${id}/play`).then((r) => r.data),
  submit: (
    id: string,
    body: {
      answers: Array<{ questionId: string; selected: number[] }>
      durationSec?: number
    },
  ) =>
    http.post<AttemptResult>(`/v1/quizzes/${id}/attempts`, body).then((r) => r.data),
}

// ─── Подготовка к экзаменам ───────────────────────────────────

export interface ExamTrack {
  id: string
  name: string
  description: string | null
  quizzesCount: number
  progress?: { total: number; attempted: number; avgPercent: number | null }
}

export const examTrackApi = {
  list: () => http.get<ExamTrack[]>('/v1/exam-prep/tracks').then((r) => r.data),
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
    http
      .post<{ score: number; best: number; isRecord: boolean }>(
        `/v1/games/${key}/scores`,
        body,
      )
      .then((r) => r.data),
  leaderboard: (key: GameKey) =>
    http.get<LeaderRow[]>(`/v1/games/${key}/leaderboard`).then((r) => r.data),
}
