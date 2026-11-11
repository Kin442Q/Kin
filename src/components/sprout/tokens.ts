/**
 * Токены дизайн-системы «Мактаби ман» (палитра «Помир») — единый источник
 * правды для Sprout-компонентов. Имя «Sprout» осталось только в коде.
 *
 * - Цвета — это **CSS-переменные** (см. index.css): светлая тема «закат» и
 *   тёмная «ночь» переключаются через html[data-theme='dark'].
 * - Для графиков, где нельзя использовать CSS var, есть `SPHex` —
 *   сырые hex-цвета палитры светлой темы.
 */
export const SP = {
  // ─── Базовые: реагируют на тему через CSS-переменные ─────────────
  bg: 'var(--sp-bg)',
  surface: 'var(--sp-surface)',
  /** Непрозрачная поверхность: окна, меню, липкие ячейки */
  solid: 'var(--sp-solid)',
  surfaceAlt: 'var(--sp-surface-alt)',
  text: 'var(--sp-text)',
  textMid: 'var(--sp-text-mid)',
  muted: 'var(--sp-muted)',
  border: 'var(--sp-border)',
  borderSoft: 'var(--sp-border-soft)',

  // ─── Акценты: бирюза — бренд, коралловый (rose) — второй акцент ───
  primary: 'var(--sp-primary)',
  /** Сплошная бирюза под белый текст (кнопки, активные плашки) — одна в обеих темах */
  primarySolid: 'var(--sp-primary-solid)',
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
  bg: '#FFEEE4',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F4',
  text: '#10282A',
  textMid: '#2C4749',
  muted: '#4A6466',
  border: '#D5DEDD',
  borderSoft: '#E6ECEB',
  primary: '#0D7A7C',
  primaryDeep: '#075B5D',
  coral: '#FF8A65',
  amber: '#FFB020',
  blue: '#3B8FBF',
  lilac: '#8B7BD4',
  cyan: '#1BA6A0',
} as const

export const shadow = {
  sm: '0 1px 2px rgba(16,40,42,0.05)',
  md: '0 10px 30px -22px rgba(16,40,42,0.38)',
  lg: '0 22px 44px -26px rgba(16,40,42,0.42)',
  glow: '0 0 0 4px rgba(13,122,124,0.16)',
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
