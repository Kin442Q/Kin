import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  toggle: () => void
  setMode: (m: ThemeMode) => void
}

/** Применяет атрибут темы на <html>: светлая («закат») или тёмная («ночь»). */
function applyMode(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
}

/**
 * Глобальный store темы. Сохраняется в localStorage и применяется
 * через атрибут data-theme на html-элементе.
 * Раньше был второй переключатель «classic/premium» — после редизайна
 * «Мактаби ман» оформление одно, в сохранённом состоянии он просто игнорируется.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      toggle: () => {
        const next: ThemeMode = get().mode === 'light' ? 'dark' : 'light'
        applyMode(next)
        set({ mode: next })
      },
      setMode: (m) => {
        applyMode(m)
        set({ mode: m })
      },
    }),
    {
      name: 'kg_theme',
      partialize: (s) => ({ mode: s.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) applyMode(state.mode ?? 'light')
      },
    },
  ),
)
