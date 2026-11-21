import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import 'dayjs/locale/en'
import 'dayjs/locale/tg'

// Язык по умолчанию русский (lang: 'ru' ниже). Без этого даты вроде «Saturday, 21 November» остаются
// по-английски, пока человек сам не выберет язык: dayjs.locale() вызывался только после выбора.
dayjs.locale('ru')

export type Lang = 'ru' | 'en' | 'tg'
const valid = (value: unknown): value is Lang => value === 'ru' || value === 'en' || value === 'tg'
export const useLangStore = create<{
  lang: Lang
  hydrate: () => Promise<void>
  setLang: (lang: Lang) => Promise<void>
}>((set) => ({
  lang: 'ru',
  hydrate: async () => {
    try {
      const saved = await AsyncStorage.getItem('kg_lang')
      if (valid(saved)) { dayjs.locale(saved); set({ lang: saved }) }
    } catch {}
  },
  setLang: async (lang) => {
    dayjs.locale(lang)
    set({ lang })
    try { await AsyncStorage.setItem('kg_lang', lang) } catch {}
  },
}))
