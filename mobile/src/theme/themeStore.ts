import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

import { getScheme, setScheme, type Scheme } from './colors'

/** Выбор человека: как в системе, всегда светлая или всегда тёмная. */
export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'theme_mode_v1'

const systemScheme = (): Scheme => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')

const resolve = (mode: ThemeMode): Scheme => (mode === 'system' ? systemScheme() : mode)

interface ThemeState {
  mode: ThemeMode
  /** Какая палитра включена сейчас (для режима «как в системе» берётся из телефона). */
  scheme: Scheme
  /** Прочитать сохранённый выбор. Вызывается один раз при старте, до первого экрана. */
  hydrate: () => Promise<void>
  setMode: (mode: ThemeMode) => Promise<void>
}

/** Переключает палитру ДО того, как подписчики получат новое значение, чтобы дерево сразу собралось в нужных цветах. */
function apply(scheme: Scheme) {
  if (getScheme() !== scheme) setScheme(scheme)
}

export const useThemeStore = create<ThemeState>((set, get) => {
  // Пока выбор не прочитан, работаем как в системе — без вспышки светлого экрана у тех, у кого тёмная тема на телефоне.
  const initial = systemScheme()
  apply(initial)

  // Режим «как в системе»: телефон переключился на тёмную — переключаемся и мы.
  Appearance.addChangeListener(() => {
    if (get().mode !== 'system') return
    const next = systemScheme()
    if (next === get().scheme) return
    apply(next)
    set({ scheme: next })
  })

  return {
    mode: 'system',
    scheme: initial,

    hydrate: async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY)
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          const scheme = resolve(saved)
          apply(scheme)
          set({ mode: saved, scheme })
        }
      } catch {
        // без сохранённого выбора остаётся «как в системе»
      }
    },

    setMode: async (mode) => {
      const scheme = resolve(mode)
      apply(scheme)
      set({ mode, scheme })
      try {
        await AsyncStorage.setItem(KEY, mode)
      } catch {
        // выбор сработает до перезапуска приложения
      }
    },
  }
})
