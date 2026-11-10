/** Readable interface text with Mont Black reserved for large headings. */
export const fontFiles = {
  MontBlack: require('../../assets/fonts/Mont-Black.ttf'),
  Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
}
export function familyFor(weight: unknown, size: unknown): string {
  const n = weight === 'bold' ? 700 : Number(weight) || 400
  if (typeof size === 'number' && size >= 24 && n >= 700) return 'MontBlack'
  if (n >= 700) return 'Inter_700Bold'
  if (n >= 600) return 'Inter_600SemiBold'
  if (n >= 500) return 'Inter_500Medium'
  return 'Inter_400Regular'
}
