/**
 * Шрифты приложения: Inter (текст) и Montserrat (заголовки, числа, логотип).
 * Файлы лежат в assets/fonts (лицензия SIL OFL) и грузятся через expo-font, поэтому
 * новых npm-пакетов не нужно. Оба шрифта содержат кириллицу (прежний Plus Jakarta Sans — нет).
 */
export const fontFiles = {
  Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
  Montserrat_400Regular: require('../../assets/fonts/Montserrat_400Regular.ttf'),
  Montserrat_700Bold: require('../../assets/fonts/Montserrat_700Bold.ttf'),
  Montserrat_800ExtraBold: require('../../assets/fonts/Montserrat_800ExtraBold.ttf'),
}

/**
 * Выбор файла шрифта по весу и размеру. С кастомными шрифтами fontWeight сам не
 * подбирает начертание (особенно на iOS), поэтому сопоставляем вручную:
 * жирный и крупный текст (заголовки, KPI-числа) — Montserrat, остальное — Inter.
 * Одинаково работает на Android и iOS.
 */
export function familyFor(weight: unknown, size: unknown): string {
  const w = typeof weight === 'string' ? weight : weight != null ? String(weight) : '400'
  const n = w === 'bold' ? 700 : w === 'normal' ? 400 : parseInt(w, 10) || 400
  const big = typeof size === 'number' && size >= 20
  if (n >= 800) return 'Montserrat_800ExtraBold'
  if (n >= 700 && big) return 'Montserrat_700Bold'
  if (n >= 700) return 'Inter_700Bold'
  if (n >= 600) return 'Inter_600SemiBold'
  if (n >= 500) return 'Inter_500Medium'
  return 'Inter_400Regular'
}
