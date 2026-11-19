/**
 * Пороги правил «Ежемесячного вердикта родителю». Единственное место, где живут числа:
 * правила (verdict-rules.ts) ничего не знают о конкретных значениях и берут их отсюда.
 *
 * Пороги по баллам зависят от шкалы школы (5 или 10) и НЕ получаются умножением на 2:
 * в проекте уже есть соответствие для ведомственной статистики (ministry.service,
 * GRADE_THRESHOLDS): 3 ↔ 4 («удовлетворительно»), 4 ↔ 7 («хорошо»), 5 ↔ 10. Строим на нём,
 * иначе школа будет «слабой» для министерства и «нормальной» для родителя.
 *
 * Значения для шкалы 10 — предложение, ждут подтверждения владельца (вопрос 1 плана).
 * Пороги школы позже смогут перекрывать эти значения (этап 2, VerdictConfig).
 */

export type VerdictScale = 'FIVE' | 'TEN'

export interface VerdictThresholds {
  /** Максимальная оценка шкалы: всё, что выше (или ниже 1), — оценка вне шкалы. */
  scaleMax: number

  // ── зависят от шкалы ──────────────────────────────────────────────────────
  /** Слабый предмет: средний балл за месяц НИЖЕ этого значения. */
  weakAverage: number
  /** «Плохая» оценка: значение не выше этого (на шкале 5 — «2» и ниже). */
  badMark: number
  /** Падение: средний за месяц ниже прошлого на столько и больше. */
  dropBy: number
  /** Сильный предмет: средний от этого значения два месяца подряд. */
  strongAverage: number

  // ── не зависят от шкалы ───────────────────────────────────────────────────
  /** Слабый предмет: сколько «плохих» оценок подряд достаточно. */
  badMarksInRow: number
  /** Слабый предмет: минимум оценок за месяц, чтобы судить о среднем. */
  weakMinGrades: number
  /** Падение: минимум оценок в каждом из двух месяцев. */
  dropMinGrades: number
  /** Сильный предмет: минимум оценок в каждом из двух месяцев. */
  strongMinGrades: number

  /** «Нет оценок»: длина окна в днях (заканчивается последним учтённым днём). */
  noGradesDays: number
  /** «Нет оценок»: минимум уроков предмета в окне, на которых ученик мог быть. */
  noGradesMinLessons: number
  /** «Нет оценок»: если ученик отсутствовал больше этой доли учебных дней окна — молчим. */
  noGradesMaxAbsentShare: number

  /** ДЗ: доля «не сдано» от проверенных заданий, с которой выдаём сигнал. */
  homeworkNotDoneShare: number
  /** ДЗ: минимум проверенных заданий у ученика по предмету. */
  homeworkMinAssessed: number
  /** ДЗ: задание считается проверенным, если учитель отметил не меньше этой доли класса. */
  homeworkMinMarkedShare: number

  /** Пропуски: минимум пропущенных уроков предмета за месяц. */
  absenceMinLessons: number
}

const COMMON = {
  badMarksInRow: 2,
  weakMinGrades: 2,
  dropMinGrades: 2,
  strongMinGrades: 3,
  noGradesDays: 21,
  noGradesMinLessons: 3,
  noGradesMaxAbsentShare: 0.5,
  homeworkNotDoneShare: 0.3,
  homeworkMinAssessed: 3,
  homeworkMinMarkedShare: 0.5,
  absenceMinLessons: 3,
} as const

export const DEFAULT_THRESHOLDS: Record<VerdictScale, VerdictThresholds> = {
  FIVE: {
    ...COMMON,
    scaleMax: 5,
    weakAverage: 3.5,
    badMark: 2,
    dropBy: 0.5,
    strongAverage: 4.7,
  },
  TEN: {
    ...COMMON,
    scaleMax: 10,
    // середина между «удовлетворительно» (4) и «хорошо» (7)
    weakAverage: 5.5,
    // ниже порога «удовлетворительно» (4)
    badMark: 3,
    // те же 10% шкалы, что 0,5 на пятибалльной
    dropBy: 1,
    // 70% пути от «хорошо» (7) к «отлично» (10), как 4,7 между 4 и 5
    strongAverage: 9.1,
  },
}

/** Пороги школы: значения по умолчанию для её шкалы, поверх них — переопределения школы. */
export function thresholdsFor(
  scale: VerdictScale,
  overrides?: Partial<Omit<VerdictThresholds, 'scaleMax'>>,
): VerdictThresholds {
  return { ...DEFAULT_THRESHOLDS[scale], ...overrides, scaleMax: DEFAULT_THRESHOLDS[scale].scaleMax }
}
