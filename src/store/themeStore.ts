import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  toggle: () => void
  setMode: (m: ThemeMode) => void
}

/**
 * Глобальный store темы. Сохраняется в localStorage и применяется
 * через атрибут data-theme на html-элементе.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      toggle: () => {
        const next: ThemeMode = get().mode === 'light' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', next)
        set({ mode: next })
      },
      setMode: (m) => {
        document.documentElement.setAttribute('data-theme', m)
        set({ mode: m })
      },
    }),
    {
      name: 'kg_theme',
      onRehydrateStorage: () => (state) => {
        if (state?.mode) {
          document.documentElement.setAttribute('data-theme', state.mode)
        }
      },
    },
  ),
)
