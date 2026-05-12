import { theme as antdTheme, ThemeConfig } from 'antd'

/**
 * Премиум-тема Ant Design в стиле Linear/Vercel.
 * Поддерживает светлый и тёмный режимы.
 */
export function buildAntdTheme(mode: 'light' | 'dark'): ThemeConfig {
  const isDark = mode === 'dark'

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: true,
    hashed: true,
    token: {
      colorPrimary: '#6366f1', // indigo-500
      colorInfo: '#6366f1',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: '#ef4444',
      colorLink: '#6366f1',
      borderRadius: 10,
      borderRadiusLG: 14,
      borderRadiusSM: 8,
      fontFamily:
        "Inter, 'Segoe UI', Tahoma, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      colorBgLayout: 'transparent',
      colorBgContainer: isDark ? 'rgba(17, 24, 39, 0.7)' : 'rgba(255, 255, 255, 0.75)',
      colorBgElevated: isDark ? 'rgba(17, 24, 39, 0.92)' : 'rgba(255, 255, 255, 0.95)',
      colorBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      colorBorderSecondary: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
      boxShadow: isDark
        ? '0 8px 30px rgba(0,0,0,0.35)'
        : '0 8px 30px rgba(15,23,42,0.06)',
      boxShadowSecondary: isDark
        ? '0 4px 20px rgba(0,0,0,0.3)'
        : '0 4px 20px rgba(15,23,42,0.05)',
    },
    components: {
      Layout: {
        headerBg: 'transparent',
        siderBg: 'transparent',
        bodyBg: 'transparent',
        headerHeight: 64,
      },
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)',
        itemSelectedColor: '#6366f1',
        itemHoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
        itemBorderRadius: 10,
        subMenuItemBg: 'transparent',
      },
      Card: {
        borderRadiusLG: 16,
        paddingLG: 20,
      },
      Table: {
        borderRadiusLG: 12,
        headerBg: isDark ? 'rgba(17,24,39,0.85)' : 'rgba(248,250,252,0.95)',
        headerSplitColor: 'transparent',
        rowHoverBg: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)',
      },
      Button: {
        borderRadius: 10,
        controlHeight: 38,
        fontWeight: 500,
      },
      Input: {
        borderRadius: 10,
        controlHeight: 38,
      },
      Select: {
        borderRadius: 10,
        controlHeight: 38,
      },
      DatePicker: {
        borderRadius: 10,
        controlHeight: 38,
      },
      Modal: {
        borderRadiusLG: 16,
      },
      Drawer: {
        colorBgElevated: isDark ? 'rgba(11,16,32,0.96)' : 'rgba(255,255,255,0.98)',
      },
      Statistic: {
        titleFontSize: 13,
        contentFontSize: 26,
      },
      Tag: {
        borderRadiusSM: 8,
      },
    },
  }
}
