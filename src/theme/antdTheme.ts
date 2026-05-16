import { theme as antdTheme, ThemeConfig } from 'antd'

/**
 * Sprout-тема Ant Design.
 * Мятная палитра, мягкие радиусы, Plus Jakarta Sans.
 */
export function buildAntdTheme(mode: 'light' | 'dark'): ThemeConfig {
  const isDark = mode === 'dark'

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: true,
    hashed: true,
    token: {
      // Sprout primary = мята
      colorPrimary: '#4FB286',
      colorInfo: '#5BA9D1',
      colorSuccess: '#4FB286',
      colorWarning: '#E5B43A',
      colorError: '#D86464',
      colorLink: '#2F8862',

      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 10,

      fontFamily:
        "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

      colorBgLayout: 'transparent',
      colorBgContainer: isDark ? 'rgba(31,45,39,0.85)' : '#FFFFFF',
      colorBgElevated: isDark ? 'rgba(31,45,39,0.95)' : '#FFFFFF',

      colorText: isDark ? '#F4F1EA' : '#1F2D27',
      colorTextSecondary: isDark ? 'rgba(244,241,234,0.7)' : '#4A5752',
      colorTextTertiary: isDark ? 'rgba(244,241,234,0.5)' : '#8A968F',

      colorBorder: isDark ? 'rgba(244,241,234,0.1)' : '#E8E4DA',
      colorBorderSecondary: isDark ? 'rgba(244,241,234,0.06)' : '#F0EDE4',

      boxShadow: '0 4px 16px -4px rgba(31,45,39,0.06)',
      boxShadowSecondary: '0 1px 2px rgba(31,45,39,0.04)',

      controlHeight: 40,
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
        itemSelectedBg: 'rgba(79,178,134,0.10)',
        itemSelectedColor: '#2F8862',
        itemHoverBg: 'rgba(79,178,134,0.06)',
        itemBorderRadius: 12,
        subMenuItemBg: 'transparent',
        itemHeight: 44,
      },
      Card: {
        borderRadiusLG: 18,
        paddingLG: 22,
      },
      Table: {
        borderRadiusLG: 14,
        headerBg: '#F4F1EA',
        headerSplitColor: 'transparent',
        rowHoverBg: 'rgba(79,178,134,0.04)',
      },
      Button: {
        borderRadius: 12,
        controlHeight: 40,
        fontWeight: 600,
        primaryShadow: '0 4px 12px -2px rgba(79,178,134,0.35)',
        defaultShadow: '0 1px 2px rgba(31,45,39,0.04)',
      },
      Input: {
        borderRadius: 12,
        controlHeight: 40,
        activeBorderColor: '#4FB286',
        hoverBorderColor: '#4FB286',
      },
      Select: {
        borderRadius: 12,
        controlHeight: 40,
      },
      DatePicker: {
        borderRadius: 12,
        controlHeight: 40,
      },
      Modal: {
        borderRadiusLG: 20,
      },
      Drawer: {
        colorBgElevated: isDark ? 'rgba(31,45,39,0.98)' : '#FFFFFF',
      },
      Statistic: {
        titleFontSize: 12,
        contentFontSize: 26,
      },
      Tag: {
        borderRadiusSM: 999, // pill-shape
      },
      Progress: {
        defaultColor: '#4FB286',
      },
      Switch: {
        colorPrimary: '#4FB286',
      },
      Checkbox: {
        colorPrimary: '#4FB286',
      },
      Radio: {
        colorPrimary: '#4FB286',
      },
    },
  }
}
