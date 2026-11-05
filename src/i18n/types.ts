/** Языки интерфейса: русский, английский, таджикский. */
export type Lang = 'ru' | 'en' | 'tg'

/** Значение перевода: строка либо формы по числу ({n} в тексте). */
export type Msg =
  | string
  | {
      one?: string
      few?: string
      many?: string
      other: string
    }

export interface LangInfo {
  code: Lang
  /** Название языка на нём самом — не переводится */
  name: string
  /** Короткая метка на кнопке */
  short: string
  /** Значение для атрибута lang у <html> */
  htmlLang: string
}

export const LANGS: LangInfo[] = [
  { code: 'ru', name: 'Русский', short: 'RU', htmlLang: 'ru' },
  { code: 'en', name: 'English', short: 'EN', htmlLang: 'en' },
  { code: 'tg', name: 'Тоҷикӣ', short: 'TJ', htmlLang: 'tg' },
]
