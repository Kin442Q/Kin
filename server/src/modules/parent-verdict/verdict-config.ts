/**
 * Пороги школы: проверка переопределений. ЧИСТАЯ функция.
 *
 * Школа может менять числа правил, но не настолько, чтобы вердикт стал опасным: «мало данных — молчим»
 * держится на нижних границах минимумов (нельзя судить о ребёнке по одной оценке, нельзя «слабым»
 * назвать предмет с оценкой 1 из 5 и т. п.). Пороги по баллам проверяются относительно шкалы школы.
 */

import { DEFAULT_THRESHOLDS, type VerdictScale, type VerdictThresholds } from './verdict-scale'

export type ThresholdOverrides = Partial<Omit<VerdictThresholds, 'scaleMax'>>

interface Rule {
  integer: boolean
  /** Границы включительно; для порогов по баллам зависят от шкалы. */
  min: (scaleMax: number) => number
  max: (scaleMax: number) => number
  label: string
}

const count = (label: string, min: number, max: number): Rule => ({ integer: true, min: () => min, max: () => max, label })
const share = (label: string, min: number, max: number): Rule => ({ integer: false, min: () => min, max: () => max, label })

export const OVERRIDE_RULES: Record<keyof ThresholdOverrides, Rule> = {
  weakAverage: { integer: false, min: () => 1.5, max: (m) => m - 0.5, label: 'Слабый предмет: средний балл ниже' },
  badMark: { integer: true, min: () => 1, max: (m) => m - 2, label: '«Плохая» оценка: не выше' },
  dropBy: { integer: false, min: (m) => m * 0.05, max: (m) => m * 0.5, label: 'Падение на' },
  strongAverage: { integer: false, min: () => 2, max: (m) => m, label: 'Сильный предмет: средний балл от' },
  badMarksInRow: count('«Плохих» оценок подряд', 2, 5),
  weakMinGrades: count('Слабый предмет: минимум оценок', 2, 10),
  dropMinGrades: count('Падение: минимум оценок в месяце', 2, 10),
  strongMinGrades: count('Сильный предмет: минимум оценок в месяце', 2, 10),
  noGradesDays: count('Нет оценок: окно, дней', 14, 60),
  noGradesMinLessons: count('Нет оценок: минимум уроков', 2, 20),
  noGradesMaxAbsentShare: share('Нет оценок: допустимая доля пропущенных дней', 0.1, 0.9),
  homeworkNotDoneShare: share('ДЗ: доля «не сдано»', 0.1, 1),
  homeworkMinAssessed: count('ДЗ: минимум проверенных заданий', 2, 30),
  homeworkMinMarkedShare: share('ДЗ: доля класса с отметкой', 0.1, 1),
  absenceMinLessons: count('Пропуски: минимум уроков', 1, 30),
}

export interface OverridesResult {
  overrides: ThresholdOverrides
  errors: string[]
}

/** Проверяет и очищает переопределения. Незнакомые ключи и значения вне границ — ошибки. */
export function validateOverrides(scale: VerdictScale, raw: unknown): OverridesResult {
  const errors: string[] = []
  const overrides: Record<string, number> = {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { overrides: {}, errors: ['Пороги должны быть объектом вида {ключ: число}'] }
  }
  const scaleMax = DEFAULT_THRESHOLDS[scale].scaleMax

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const rule = (OVERRIDE_RULES as Record<string, Rule | undefined>)[key]
    if (!rule) {
      errors.push(`Неизвестный порог: ${key}`)
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${rule.label}: нужно число`)
      continue
    }
    if (rule.integer && !Number.isInteger(value)) {
      errors.push(`${rule.label}: нужно целое число`)
      continue
    }
    const lo = rule.min(scaleMax)
    const hi = rule.max(scaleMax)
    if (value < lo || value > hi) {
      errors.push(`${rule.label}: допустимо от ${lo} до ${hi}`)
      continue
    }
    overrides[key] = Math.round(value * 100) / 100
  }

  // согласованность итоговых значений: «плохая» оценка ниже порога «слабого», «слабый» ниже «сильного»
  const merged = { ...DEFAULT_THRESHOLDS[scale], ...overrides }
  if (merged.badMark >= merged.weakAverage) errors.push('«Плохая» оценка должна быть ниже порога слабого предмета')
  if (merged.weakAverage >= merged.strongAverage) errors.push('Порог слабого предмета должен быть ниже порога сильного')

  return { overrides: errors.length ? {} : (overrides as ThresholdOverrides), errors }
}
