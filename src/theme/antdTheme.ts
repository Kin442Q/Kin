import { theme as antdTheme, ThemeConfig } from 'antd'
import type { ThemeDesign } from '../store/themeStore'

/**
 * Тема Ant Design.
 *
 * Поддерживает два дизайн-варианта:
 *  - classic  — текущая мятная Sprout-тема (как было)
 *  - premium  — премиум-редизайн: насыщенный зелёный, крупнее радиусы,
 *               глубже тени, акцент на «дорогую» подачу.
 *
 * Цветовые токены большинства компонентов берутся из CSS-переменных --sp-*
 * (см. index.css), которые сами переключаются между classic/premium —
 * здесь мы задаём только то, что AntD не умеет читать из CSS.
 */
export function buildAntdTheme(
  mode: 'light' | 'dark',
  design: ThemeDesign = 'classic',
): ThemeConfig {
  const isDark = mode === 'dark'
  const isPremium = design === 'premium'

  // Палитра primary под выбранный дизайн
  const primary = isPremium ? '#3DA776' : '#4FB286'
  const primaryDeep = isPremium ? '#1F855A' : '#2F8862'
  const link = primaryDeep
  const success = primary

  // Радиусы — в премиуме чуть крупнее (мягче)
  const r = isPremium ? 14 : 12
  const rLG = isPremium ? 18 : 16
  const rSM = isPremium ? 11 : 10

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: true,
    hashed: true,
    token: {
      colorPrimary: primary,
      colorInfo: isPremium ? '#5BA9D1' : '#5BA9D1',
      colorSuccess: success,
      colorWarning: isPremium ? '#E5B43A' : '#E5B43A',
      colorError: isPremium ? '#D2615B' : '#D86464',
      colorLink: link,

      borderRadius: r,
      borderRadiusLG: rLG,
      borderRadiusSM: rSM,

      fontFamily:
        "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

      colorBgLayout: 'transparent',
      colorBgContainer: isDark ? 'rgba(31,45,39,0.85)' : '#FFFFFF',
      colorBgElevated: isDark ? 'rgba(31,45,39,0.95)' : '#FFFFFF',

      colorText: isDark ? '#F4F1EA' : isPremium ? '#16261F' : '#1F2D27',
      colorTextSecondary: isDark
        ? 'rgba(244,241,234,0.7)'
        : isPremium
          ? '#46554E'
          : '#4A5752',
      colorTextTertiary: isDark
        ? 'rgba(244,241,234,0.5)'
        : isPremium
          ? '#7E8B84'
          : '#8A968F',

      colorBorder: isDark
        ? 'rgba(244,241,234,0.1)'
        : isPremium
          ? '#E7EAE6'
          : '#E8E4DA',
      colorBorderSecondary: isDark
        ? 'rgba(244,241,234,0.06)'
        : isPremium
          ? '#EFF2EE'
          : '#F0EDE4',

      boxShadow: isPremium
        ? '0 2px 6px -2px rgba(22,38,31,0.06),0 10px 26px -10px rgba(22,38,31,0.10)'
        : '0 4px 16px -4px rgba(31,45,39,0.06)',
      boxShadowSecondary: isPremium
        ? '0 1px 2px rgba(22,38,31,0.05)'
        : '0 1px 2px rgba(31,45,39,0.04)',

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
        itemSelectedBg: isPremium
          ? 'rgba(61,167,118,0.16)'
          : 'rgba(79,178,134,0.10)',
        itemSelectedColor: primaryDeep,
        itemHoverBg: isPremium
          ? 'rgba(61,167,118,0.08)'
          : 'rgba(79,178,134,0.06)',
        itemBorderRadius: 12,
        subMenuItemBg: 'transparent',
        itemHeight: 44,
      },
      Card: {
        borderRadiusLG: isPremium ? 18 : 18,
        paddingLG: isPremium ? 20 : 22,
      },
      Table: {
        borderRadiusLG: 14,
        headerBg: isPremium ? '#F1F4F1' : '#F4F1EA',
        headerSplitColor: 'transparent',
        rowHoverBg: isPremium
          ? 'rgba(61,167,118,0.06)'
          : 'rgba(79,178,134,0.04)',
      },
      Button: {
        borderRadius: r,
        controlHeight: 40,
        fontWeight: isPremium ? 700 : 600,
        primaryShadow: isPremium
          ? '0 8px 18px -6px rgba(31,133,90,0.5)'
          : '0 4px 12px -2px rgba(79,178,134,0.35)',
        defaultShadow: '0 1px 2px rgba(31,45,39,0.04)',
      },
      Input: {
        borderRadius: r,
        controlHeight: 40,
        activeBorderColor: primary,
        hoverBorderColor: primary,
      },
      Select: {
        borderRadius: r,
        controlHeight: 40,
      },
      DatePicker: {
        borderRadius: r,
        controlHeight: 40,
      },
      Modal: {
        borderRadiusLG: isPremium ? 24 : 20,
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
        defaultColor: primary,
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
        itemSelectedColor: primaryDeep,
      },
    },
  }
}
