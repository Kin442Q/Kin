import ruRU from 'antd/locale/ru_RU'
import enUS from 'antd/locale/en_US'
import type { Locale } from 'antd/es/locale'

import type { Lang } from './types'

/**
 * В antd нет таджикской локали: берём русскую как основу и переопределяем то,
 * что пользователь видит чаще всего (кнопки окон, пагинация, пустые списки,
 * таблицы). Остальные редкие подписи остаются русскими.
 */
const tgTJ = {
  ...ruRU,
  locale: 'tg',
  Pagination: {
    ...ruRU.Pagination,
    items_per_page: '/ саҳ.',
    jump_to: 'Гузариш',
    jump_to_confirm: 'тасдиқ',
    page: 'Саҳифа',
    prev_page: 'Саҳифаи қаблӣ',
    next_page: 'Саҳифаи баъдӣ',
    prev_5: '5 саҳифаи қаблӣ',
    next_5: '5 саҳифаи баъдӣ',
    prev_3: '3 саҳифаи қаблӣ',
    next_3: '3 саҳифаи баъдӣ',
    page_size: 'андозаи саҳифа',
  },
  Modal: { okText: 'Тасдиқ', cancelText: 'Бекор кардан', justOkText: 'Хуб' },
  Popconfirm: { okText: 'Ҳа', cancelText: 'Не' },
  Empty: { description: 'Маълумот нест' },
  Table: {
    ...ruRU.Table,
    filterTitle: 'Филтр',
    filterConfirm: 'ОК',
    filterReset: 'Тоза кардан',
    emptyText: 'Маълумот нест',
    selectAll: 'Ҳамаро интихоб кардан',
    selectInvert: 'Баръакс',
    sortTitle: 'Ҷудокунӣ',
    cancelSort: 'Бекор кардани ҷудокунӣ',
  },
} as Locale

export function antdLocale(lang: Lang): Locale {
  return lang === 'en' ? enUS : lang === 'tg' ? tgTJ : ruRU
}
