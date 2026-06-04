/**
 * Sprout design tokens — единый источник правды для всех Sprout-компонентов.
 *
 * - Базовые цвета (фон, поверхность, текст, границы) — это **CSS-переменные**,
 *   они автоматически переключаются между светлой и тёмной темой через
 *   `[data-theme='dark']` в index.css.
 * - Акцентные цвета (мята, голубой, жёлтый, и т.д.) — hex-константы,
 *   потому что они одинаковые в обеих темах.
 *
 * Если нужны hex-значения базовых цветов (для графиков/charts), используйте
 * `SPHex` ниже — там лежат сырые цвета светлой темы.
 */
export const SP = {
  // ─── Базовые: реагируют на тему через CSS-переменные ─────────────
  bg: 'var(--sp-bg)',
  surface: 'var(--sp-surface)',
  surfaceAlt: 'var(--sp-surface-alt)',
  text: 'var(--sp-text)',
  textMid: 'var(--sp-text-mid)',
  muted: 'var(--sp-muted)',
  border: 'var(--sp-border)',
  borderSoft: 'var(--sp-border-soft)',

  // ─── Акценты: теперь тоже CSS-переменные ─────────────────────────
  // Раньше это были hex-константы, из-за чего инлайн-стили (логотип,
  // аватар, кнопки, плашки иконок, Pro-карточка) НЕ реагировали на
  // переключение classic ↔ premium. Теперь каждый акцент переключается
  // вместе с дизайн-темой (значения см. в index.css).
  primary: 'var(--sp-primary)',
  primaryDeep: 'var(--sp-primary-deep)',
  primarySoft: 'var(--sp-primary-soft)',
  primaryGhost: 'var(--sp-primary-ghost)',

  blue: 'var(--sp-blue)',
  blueDeep: 'var(--sp-blue-deep)',
  blueSoft: 'var(--sp-blue-soft)',

  yellow: 'var(--sp-yellow)',
  yellowDeep: 'var(--sp-yellow-deep)',
  yellowSoft: 'var(--sp-yellow-soft)',

  rose: 'var(--sp-rose)',
  roseDeep: 'var(--sp-rose-deep)',
  roseSoft: 'var(--sp-rose-soft)',

  pink: 'var(--sp-pink)',
  pinkSoft: 'var(--sp-pink-soft)',

  lilac: 'var(--sp-lilac)',
  lilacDeep: 'var(--sp-lilac-deep)',
  lilacSoft: 'var(--sp-lilac-soft)',

  cyan: 'var(--sp-cyan)',
  cyanSoft: 'var(--sp-cyan-soft)',

  danger: 'var(--sp-danger)',
} as const

/**
 * Hex-цвета светлой темы — для графиков и других мест где нельзя
 * использовать CSS var (например конфиг chart-библиотеки).
 */
export const SPHex = {
  bg: '#FBF9F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F1EA',
  text: '#1F2D27',
  textMid: '#4A5752',
  muted: '#8A968F',
  border: '#E8E4DA',
  borderSoft: '#F0EDE4',
} as const

export const shadow = {
  sm: '0 1px 2px rgba(31,45,39,0.04)',
  md: '0 4px 16px -4px rgba(31,45,39,0.06)',
  lg: '0 16px 48px -16px rgba(79,178,134,0.18), 0 4px 12px -2px rgba(31,45,39,0.04)',
  glow: '0 0 0 4px rgba(79,178,134,0.12)',
} as const

export type SproutAccent =
  | 'mint'
  | 'blue'
  | 'yellow'
  | 'lilac'
  | 'rose'
  | 'pink'
  | 'cyan'
  | 'gray'

/** Карта accent → пара цветов (фон плашки + цвет иконки/текста) */
export const accentMap: Record<SproutAccent, { bg: string; fg: string }> = {
  mint: { bg: SP.primaryGhost, fg: SP.primaryDeep },
  blue: { bg: SP.blueSoft, fg: SP.blueDeep },
  yellow: { bg: SP.yellowSoft, fg: SP.yellowDeep },
  lilac: { bg: SP.lilacSoft, fg: SP.lilacDeep },
  rose: { bg: SP.roseSoft, fg: SP.roseDeep },
  pink: { bg: SP.pinkSoft, fg: SP.pink },
  cyan: { bg: SP.cyanSoft, fg: SP.cyan },
  gray: { bg: SP.borderSoft, fg: SP.textMid },
}
