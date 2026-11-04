/**
 * Дизайн-токены мобильного приложения «Мактаби ман» — тот же язык, что и в вебе
 * (палитра «Помир»: бирюзовый + коралловый, мягкое стекло на закате).
 * Ключи сохранены от прежней темы, чтобы экраны менялись без правок.
 */
export const colors = {
  /** Основа экрана (под фоновым слоем «закат») */
  bg: '#FFE4D6',
  /** Карточка-«стекло»: слегка прозрачный белый поверх фона */
  surface: 'rgba(255,255,255,0.84)',
  /** Непрозрачная поверхность: окна, панель вкладок, выпадающие списки, поля ввода */
  surfaceSolid: '#FFFFFF',
  /** Внутренняя плашка (чипы, неактивные кнопки): лёгкий тёмный оттенок */
  surfaceAlt: 'rgba(16,40,42,0.06)',

  primary: '#0D7A7C',
  primaryDeep: '#075B5D',
  primarySoft: 'rgba(13,122,124,0.14)',
  primaryGhost: 'rgba(13,122,124,0.08)',

  /** Коралловый — второй акцент бренда (бейджи, фокус, солнце) */
  coral: '#FF8A65',

  blue: '#3B8FBF',
  blueDeep: '#1F5F8F',
  blueSoft: 'rgba(59,143,191,0.15)',

  yellow: '#FFB020',
  yellowDeep: '#7A5200',
  yellowSoft: 'rgba(255,176,32,0.22)',

  rose: '#FF8A65',
  roseDeep: '#B8431F',
  roseSoft: 'rgba(255,138,101,0.22)',

  lilac: '#8B7BD4',
  lilacDeep: '#4F3FB0',
  lilacSoft: 'rgba(139,123,212,0.17)',

  text: '#10282A',
  textMid: '#2C4749',
  muted: '#4A6466',

  border: 'rgba(16,40,42,0.14)',
  borderSoft: 'rgba(16,40,42,0.08)',
  /** Светлая рамка стеклянной карточки */
  glassBorder: 'rgba(255,255,255,0.75)',

  danger: '#C0392B',
} as const

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const

/** Тени для iOS (shadow*) и Android (elevation) */
export const shadow = {
  sm: {
    shadowColor: '#10282A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#10282A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  lg: {
    shadowColor: '#075B5D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const

/**
 * Семейства шрифтов. Подключаются в `theme/fonts.ts`:
 * Inter — текст, Montserrat — заголовки, крупные числа и логотип.
 * Выбор по `fontWeight` делает патч Text (см. `applyFonts`), поэтому в стилях
 * экранов достаточно по-прежнему писать fontWeight.
 */
export const font = {
  family: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    heading: 'Montserrat_700Bold',
    extrabold: 'Montserrat_800ExtraBold',
  },
  size: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 36,
  },
} as const
