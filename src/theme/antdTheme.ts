import { theme as antdTheme, ThemeConfig } from 'antd'

/**
 * Тема Ant Design для «Мактаби ман» (палитра «Помир»).
 *
 * Бирюзовый — основной, коралловый — акцент (фокус, бейджи). Поверхности
 * стеклянные: полупрозрачные контейнеры лежат поверх фонового слоя
 * (закат / ночные горы, см. AppBackdrop), а окна и выпадающие меню — сплошные,
 * чтобы текст не терялся на фоне.
 *
 * Большую часть цветов Sprout-компонентов задают CSS-переменные --sp-*
 * (index.css); здесь — то, что AntD не умеет читать из CSS.
 */
export function buildAntdTheme(mode: 'light' | 'dark'): ThemeConfig {
  const isDark = mode === 'dark'

  const primary = '#0D7A7C'
  const primaryHover = isDark ? '#1BA6A0' : '#075B5D'
  const primaryActive = '#064A4C'
  // Текст и ссылки: на тёмном фоне бирюза светлее, иначе не читается
  const link = isDark ? '#5FD0CB' : '#075B5D'
  const coral = '#FF8A65'

  const text = isDark ? '#F2F7F6' : '#10282A'
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.72)'
  const border = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(16,40,42,0.14)'
  const borderSoft = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(16,40,42,0.08)'

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: true,
    hashed: true,
    token: {
      colorPrimary: primary,
      colorPrimaryHover: primaryHover,
      colorPrimaryActive: primaryActive,
      colorInfo: isDark ? '#7CC0EA' : '#3B8FBF',
      colorSuccess: isDark ? '#5FD0CB' : '#0D7A7C',
      colorWarning: isDark ? '#FFC93C' : '#E69A00',
      colorError: isDark ? '#FF7A6B' : '#C0392B',
      colorLink: link,
      colorLinkHover: isDark ? '#8FE3DF' : '#10282A',

      borderRadius: 14,
      borderRadiusLG: 22,
      borderRadiusSM: 10,

      fontFamily:
        "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

      colorBgLayout: 'transparent',
      colorBgContainer: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.58)',
      colorBgElevated: isDark ? '#0F2D2F' : '#FFFFFF',

      colorText: text,
      colorTextSecondary: isDark ? '#D3E2E2' : '#2C4749',
      colorTextTertiary: isDark ? '#A9C2C3' : '#4A6466',
      colorTextPlaceholder: isDark ? 'rgba(242,247,246,0.55)' : 'rgba(16,40,42,0.55)',

      colorBorder: border,
      colorBorderSecondary: borderSoft,
      colorSplit: borderSoft,

      boxShadow: isDark
        ? '0 14px 34px -22px rgba(0,0,0,0.7)'
        : '0 10px 30px -22px rgba(16,40,42,0.38)',
      boxShadowSecondary: isDark
        ? '0 1px 2px rgba(0,0,0,0.3)'
        : '0 1px 2px rgba(16,40,42,0.05)',

      controlHeight: 42,
      controlOutline: isDark ? 'rgba(95,208,203,0.25)' : 'rgba(13,122,124,0.16)',
      controlOutlineWidth: 4,
      controlItemBgActive: isDark ? 'rgba(95,208,203,0.18)' : 'rgba(13,122,124,0.12)',
      controlItemBgHover: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,122,124,0.07)',
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
        itemSelectedBg: isDark ? 'rgba(95,208,203,0.18)' : 'rgba(255,255,255,0.8)',
        itemSelectedColor: link,
        itemHoverBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,122,124,0.08)',
        itemBorderRadius: 12,
        subMenuItemBg: 'transparent',
        itemHeight: 42,
        groupTitleColor: isDark ? '#A9C2C3' : '#4A6466',
      },
      Card: {
        borderRadiusLG: 22,
        paddingLG: 22,
        colorBgContainer: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.58)',
      },
      Table: {
        borderRadiusLG: 18,
        headerBg: isDark ? 'rgba(95,208,203,0.1)' : 'rgba(13,122,124,0.08)',
        headerColor: isDark ? '#A9C2C3' : '#4A6466',
        headerSplitColor: 'transparent',
        rowHoverBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,122,124,0.06)',
        borderColor: borderSoft,
      },
      Button: {
        borderRadius: 14,
        borderRadiusLG: 16,
        borderRadiusSM: 12,
        controlHeight: 42,
        fontWeight: 600,
        primaryShadow: '0 8px 18px -8px rgba(13,122,124,0.7)',
        defaultShadow: 'none',
        dangerShadow: 'none',
        defaultBg: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)',
        defaultColor: isDark ? '#F2F7F6' : '#10282A',
        defaultBorderColor: border,
        defaultHoverColor: link,
        defaultHoverBorderColor: primary,
        defaultHoverBg: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)',
        textHoverBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,122,124,0.08)',
      },
      Input: {
        borderRadius: 14,
        controlHeight: 42,
        colorBgContainer: inputBg,
        activeBorderColor: primary,
        hoverBorderColor: primary,
        activeBg: isDark ? 'rgba(255,255,255,0.1)' : '#FFFFFF',
      },
      InputNumber: {
        borderRadius: 14,
        controlHeight: 42,
        colorBgContainer: inputBg,
        activeBorderColor: primary,
        hoverBorderColor: primary,
      },
      Select: {
        borderRadius: 14,
        controlHeight: 42,
        colorBgContainer: inputBg,
        optionSelectedBg: isDark ? 'rgba(95,208,203,0.18)' : 'rgba(13,122,124,0.12)',
        optionActiveBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,122,124,0.07)',
      },
      DatePicker: {
        borderRadius: 14,
        controlHeight: 42,
        colorBgContainer: inputBg,
        activeBorderColor: primary,
        hoverBorderColor: primary,
      },
      Modal: {
        borderRadiusLG: 28,
        contentBg: isDark ? '#0F2D2F' : '#FFFFFF',
        headerBg: isDark ? '#0F2D2F' : '#FFFFFF',
      },
      Drawer: {
        colorBgElevated: isDark ? '#0F2D2F' : '#FFFFFF',
      },
      Statistic: {
        titleFontSize: 12,
        contentFontSize: 26,
      },
      Tag: {
        borderRadiusSM: 999, // pill-shape
      },
      Badge: {
        colorError: coral,
        textFontSize: 12,
      },
      Progress: {
        defaultColor: isDark ? '#5FD0CB' : primary,
        remainingColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(16,40,42,0.08)',
      },
      Switch: {
        colorPrimary: primary,
      },
      Checkbox: {
        colorPrimary: primary,
      },
      Radio: {
        colorPrimary: primary,
      },
      Segmented: {
        itemSelectedColor: link,
        trackBg: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(16,40,42,0.06)',
        itemSelectedBg: isDark ? 'rgba(95,208,203,0.18)' : '#FFFFFF',
        borderRadius: 14,
        borderRadiusSM: 12,
      },
      Tabs: {
        itemSelectedColor: link,
        itemHoverColor: link,
        inkBarColor: coral,
      },
      Alert: {
        borderRadiusLG: 16,
      },
      Dropdown: {
        borderRadiusLG: 16,
      },
      Tooltip: {
        colorBgSpotlight: isDark ? '#1B4A4C' : '#10282A',
      },
    },
  }
}
