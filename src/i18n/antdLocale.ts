import ruRU from 'antd/locale/ru_RU'
import enUS from 'antd/locale/en_US'
import type { Locale } from 'antd/es/locale'
import tgTJ from './tgAntd.json'
import type { Lang } from './types'

/** Complete local UI copy, including calendars, validation, uploads and tables. */
export function antdLocale(lang: Lang): Locale {
  return lang === 'en' ? enUS : lang === 'tg' ? tgTJ as unknown as Locale : ruRU
}
