import { useThemeStore } from '../store/themeStore'

/**
 * Палитры графиков: бирюза и коралл — первыми, дальше цвета данных.
 * Светлая тема — насыщенные тона, тёмная — светлее, чтобы читались на ночном фоне.
 */
const LIGHT = ['#0D7A7C', '#FF8A65', '#FFB020', '#3B8FBF', '#8B7BD4', '#D9709B', '#1BA6A0', '#075B5D', '#C0392B', '#5FD0CB']
const DARK = ['#5FD0CB', '#FF8A65', '#FFC93C', '#7CC0EA', '#A99BF0', '#F08FB5', '#4FD6CF', '#8FE3DF', '#FF7A6B', '#FFD97A']

/** Тема G2 (для prop `theme` у графиков @ant-design/charts) под текущую тему приложения. */
export function chartThemeFor(mode: 'light' | 'dark') {
  const palette = mode === 'dark' ? DARK : LIGHT
  return {
    type: mode === 'dark' ? 'dark' : 'classic',
    category10: palette,
    category20: [...palette, ...palette],
    colorDefault: palette[0],
    colorBackground: 'transparent',
  }
}

export function useChartTheme() {
  const mode = useThemeStore((s) => s.mode)
  return chartThemeFor(mode)
}
