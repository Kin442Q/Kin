/**
 * Sprout Mobile design tokens — единый язык с веб-версией KinderCRM.
 * Палитра: мята + крем + жёлтый + лиловый. Шрифт — Plus Jakarta Sans.
 */
export const colors = {
  bg: '#FBF9F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F1EA',

  primary: '#4FB286',
  primaryDeep: '#2F8862',
  primarySoft: '#D8EFE3',
  primaryGhost: '#EEF7F2',

  blue: '#A8D8F0',
  blueDeep: '#5BA9D1',
  blueSoft: '#E0EEF7',

  yellow: '#FFE08A',
  yellowDeep: '#E5B43A',
  yellowSoft: '#FDF4D6',

  rose: '#F4B5B5',
  roseDeep: '#D86464',
  roseSoft: '#FCEAE5',

  lilac: '#C7B8E8',
  lilacDeep: '#9B7BD4',
  lilacSoft: '#EFE9F8',

  text: '#1F2D27',
  textMid: '#4A5752',
  muted: '#8A968F',

  border: '#E8E4DA',
  borderSoft: '#F0EDE4',

  danger: '#D86464',
} as const

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const

/** React Native shadow для iOS + Android elevation */
export const shadow = {
  sm: {
    shadowColor: '#1F2D27',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#1F2D27',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  lg: {
    shadowColor: '#4FB286',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
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

export const font = {
  family: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
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
