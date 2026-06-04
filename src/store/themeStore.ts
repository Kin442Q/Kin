import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'
/**
 * Дизайн-вариант (вторая «тема»):
 *  - classic — текущее оформление (мята + крем, как было)
 *  - premium — новый премиум-редизайн (Sprout, насыщенный зелёный, glass-шапка,
 *    градиентные кнопки, многослойные тени)
 */
export type ThemeDesign = 'classic' | 'premium'

interface ThemeState {
  mode: ThemeMode
  design: ThemeDesign
  toggle: () => void
  setMode: (m: ThemeMode) => void
  setDesign: (d: ThemeDesign) => void
  toggleDesign: () => void
}

/** Применяет атрибуты темы на <html>. */
function applyAttrs(mode: ThemeMode, design: ThemeDesign) {
  const el = document.documentElement
  el.setAttribute('data-theme', mode)
  el.setAttribute('data-design', design)
}

/**
 * Глобальный store темы. Сохраняется в localStorage и применяется
 * через атрибуты data-theme (светлая/тёмная) и data-design (classic/premium)
 * на html-элементе.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      // По умолчанию показываем новый премиум-редизайн (основной акцент).
      design: 'premium',
      toggle: () => {
        const next: ThemeMode = get().mode === 'light' ? 'dark' : 'light'
        applyAttrs(next, get().design)
        set({ mode: next })
      },
      setMode: (m) => {
        applyAttrs(m, get().design)
        set({ mode: m })
      },
      setDesign: (d) => {
        applyAttrs(get().mode, d)
        set({ design: d })
      },
      toggleDesign: () => {
        const next: ThemeDesign =
          get().design === 'premium' ? 'classic' : 'premium'
        applyAttrs(get().mode, next)
        set({ design: next })
      },
    }),
    {
      name: 'kg_theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyAttrs(state.mode ?? 'light', state.design ?? 'premium')
        }
      },
    },
  ),
)
