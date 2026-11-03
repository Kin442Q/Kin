import { BadRequestException } from '@nestjs/common'

/**
 * Чистая логика квизов: проверка вопросов, оценка попытки, «безопасный» вид
 * вопроса для ученика. Без доступа к БД — поэтому легко тестируется.
 */

export type QuestionKindName = 'SINGLE' | 'MULTIPLE'

export interface QuizOption {
  text: string
  correct: boolean
}

export interface QuestionInput {
  text: string
  kind: QuestionKindName
  options: QuizOption[]
  explanation?: string | null
}

/** Вопрос в том виде, в каком он лежит в БД. */
export interface StoredQuestion {
  id: string
  position: number
  text: string
  kind: QuestionKindName
  options: QuizOption[]
  explanation: string | null
}

export interface AnswerInput {
  questionId: string
  /** Индексы выбранных вариантов. */
  selected: number[]
}

export interface ReviewItem {
  questionId: string
  correct: boolean
  selected: number[]
  correctOptions: number[]
  explanation: string | null
}

export interface GradeResult {
  score: number
  total: number
  percent: number
  review: ReviewItem[]
}

export const QUIZ_LIMITS = {
  maxQuestions: 100,
  minOptions: 2,
  maxOptions: 8,
  maxQuestionText: 1000,
  maxOptionText: 300,
} as const

/**
 * Проверяет вопросы при создании/правке квиза. Сообщения на русском с номером
 * вопроса — их увидит учитель в редакторе.
 */
export function validateQuestions(questions: QuestionInput[]): void {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new BadRequestException('Добавьте хотя бы один вопрос')
  }
  if (questions.length > QUIZ_LIMITS.maxQuestions) {
    throw new BadRequestException(`Не больше ${QUIZ_LIMITS.maxQuestions} вопросов в квизе`)
  }

  questions.forEach((q, i) => {
    const n = i + 1
    if (!q.text?.trim()) throw new BadRequestException(`Вопрос ${n}: введите текст вопроса`)
    if (q.text.length > QUIZ_LIMITS.maxQuestionText) {
      throw new BadRequestException(`Вопрос ${n}: текст длиннее ${QUIZ_LIMITS.maxQuestionText} символов`)
    }
    if (q.kind !== 'SINGLE' && q.kind !== 'MULTIPLE') {
      throw new BadRequestException(`Вопрос ${n}: неизвестный тип вопроса`)
    }
    const opts = q.options ?? []
    if (opts.length < QUIZ_LIMITS.minOptions || opts.length > QUIZ_LIMITS.maxOptions) {
      throw new BadRequestException(
        `Вопрос ${n}: нужно от ${QUIZ_LIMITS.minOptions} до ${QUIZ_LIMITS.maxOptions} вариантов ответа`,
      )
    }
    opts.forEach((o, j) => {
      if (!o.text?.trim()) throw new BadRequestException(`Вопрос ${n}: вариант ${j + 1} пустой`)
      if (o.text.length > QUIZ_LIMITS.maxOptionText) {
        throw new BadRequestException(`Вопрос ${n}: вариант ${j + 1} длиннее ${QUIZ_LIMITS.maxOptionText} символов`)
      }
    })
    const correct = opts.filter((o) => o.correct).length
    if (q.kind === 'SINGLE' && correct !== 1) {
      throw new BadRequestException(`Вопрос ${n}: отметьте ровно один правильный ответ`)
    }
    if (q.kind === 'MULTIPLE' && correct < 1) {
      throw new BadRequestException(`Вопрос ${n}: отметьте хотя бы один правильный ответ`)
    }
  })
}

/** Читает options из Json-колонки осторожно: битые записи не роняют проверку. */
export function parseOptions(json: unknown): QuizOption[] {
  if (!Array.isArray(json)) return []
  return json
    .filter((o): o is { text: unknown; correct: unknown } => !!o && typeof o === 'object')
    .map((o) => ({ text: String(o.text ?? ''), correct: o.correct === true }))
}

/** Выбранные индексы → уникальные, существующие в вопросе. */
function normalizeSelected(selected: unknown, optionsCount: number): number[] {
  if (!Array.isArray(selected)) return []
  return [...new Set(selected.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < optionsCount))]
}

/**
 * Оценка попытки. Вопрос засчитывается только при точном совпадении:
 *  - SINGLE: выбран ровно один вариант, и он правильный;
 *  - MULTIPLE: выбран ровно набор правильных (без лишних и без пропусков).
 * Без ответа — неверно. Ответы на несуществующие вопросы игнорируются.
 */
export function gradeAttempt(questions: StoredQuestion[], answers: AnswerInput[]): GradeResult {
  const byQuestion = new Map<string, AnswerInput>()
  for (const a of answers ?? []) {
    if (a && typeof a.questionId === 'string') byQuestion.set(a.questionId, a)
  }

  const review: ReviewItem[] = questions.map((q) => {
    const selected = normalizeSelected(byQuestion.get(q.id)?.selected, q.options.length)
    const correctOptions = q.options.flatMap((o, i) => (o.correct ? [i] : []))
    const correct =
      selected.length === correctOptions.length && correctOptions.every((i) => selected.includes(i))
    return { questionId: q.id, correct, selected, correctOptions, explanation: q.explanation }
  })

  const score = review.filter((r) => r.correct).length
  const total = questions.length
  return { score, total, percent: total > 0 ? Math.round((score / total) * 100) : 0, review }
}

/** Вопрос для ученика: без признаков правильных ответов и пояснения. */
export function toPlayQuestion(q: StoredQuestion) {
  return {
    id: q.id,
    position: q.position,
    text: q.text,
    kind: q.kind,
    options: q.options.map((o) => ({ text: o.text })),
  }
}

/** Лучший результат ученика по квизу (в процентах) среди попыток. */
export function bestOf(attempts: Array<{ score: number; total: number }>) {
  if (attempts.length === 0) return null
  const percent = (a: { score: number; total: number }) => (a.total > 0 ? Math.round((a.score / a.total) * 100) : 0)
  const best = attempts.reduce((b, a) => (percent(a) > percent(b) ? a : b))
  return { score: best.score, total: best.total, percent: percent(best), attempts: attempts.length }
}
