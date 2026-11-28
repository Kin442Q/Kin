import { colors } from '../theme/colors'

import { themedValue } from '../theme/themedStyles'
/**
 * Цвета оценки в «плашках» из макета. Оценки в системе — от 1 до 10, но в школах
 * часто пользуются пятибалльной шкалой, поэтому шкала определяется по самой оценке:
 * до 5 включительно — пятибалльная (5 — отлично, 4 — хорошо), выше — десятибалльная.
 */
export interface GradeTone {
  bg: string
  fg: string
}

const TEAL = themedValue<GradeTone>(() => ({ bg: colors.primary, fg: '#FFFFFF' }))
const MINT = themedValue<GradeTone>(() => ({ bg: colors.avatarBg, fg: colors.text }))
const CORAL = themedValue<GradeTone>(() => ({ bg: colors.coral, fg: '#10282A' }))
const NONE = themedValue<GradeTone>(() => ({ bg: colors.surfaceAlt, fg: colors.textMid }))

/** scaleMax (5 или 10) передают там, где шкала школы известна: тогда «5 из 10» не выглядит отличной. */
export function gradeTone(value: number | null | undefined, scaleMax?: number): GradeTone {
  if (value == null || !isFinite(value)) return NONE()
  const five = scaleMax ? scaleMax <= 5 : value <= 5
  if (five) return value >= 5 ? TEAL() : value >= 4 ? MINT() : CORAL()
  return value >= 9 ? TEAL() : value >= 7 ? MINT() : CORAL()
}

/** Цвет среднего балла (число крупно в строке предмета). */
export function averageColor(avg: number): string {
  const five = avg <= 5
  const hi = five ? 4.5 : 8.5
  const mid = five ? 4 : 7
  return avg >= hi ? colors.primary : avg >= mid ? colors.text : '#B8452A'
}
