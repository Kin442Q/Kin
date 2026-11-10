import { beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import messages from './uiMessages.json'
import nativeMessages from '../../mobile/src/i18n/messages.json'
import { useLangStore } from './index'
import { localizeCopy, uiText, uiTextFor } from './uiText'
import { toBackendCategory, toRussianCategory } from '../lib/expenseCategoryMap'
import { toBackendPosition, toRussianPosition } from '../lib/positionMap'
import { antdLocale } from './antdLocale'

beforeEach(() => useLangStore.getState().setLang('ru'))

describe('full interface localization', () => {
  it('contains complete English and Tajik copy and a matching native bundle', () => {
    expect(nativeMessages).toEqual(messages)
    for (const [source, value] of Object.entries(messages)) {
      expect(value.en.trim(), source).not.toBe('')
      expect(value.tg.trim(), source).not.toBe('')
      expect(value.en, source).not.toMatch(/[А-Яа-яЁё]/)
      const placeholders = source.match(/\{\w+\}/g) ?? []
      for (const target of [value.en, value.tg]) {
        for (const placeholder of target.match(/\{\w+\}/g) ?? []) expect(placeholders, source).toContain(placeholder)
      }
    }
  })
  it('updates static option labels without changing API values', () => {
    const options = localizeCopy([{label:'Ученики',value:'Ученики'}, {label:'Новая школа',value:'create'}])
    useLangStore.getState().setLang('en')
    expect(options[0].label).toBe('Students')
    expect(options[0].value).toBe('Ученики')
    useLangStore.getState().setLang('tg')
    expect(options[1].label).toBe('Мактаби нав')
    expect(options[1].value).toBe('create')
  })
  it('preserves React icons inside localized navigation definitions', () => {
    const icon = createElement('span', null, 'icon')
    const options = localizeCopy([{ label:'Ученики', icon }])
    useLangStore.getState().setLang('en')
    expect(options[0].icon).toBe(icon)
    expect(options[0].label).toBe('Students')
  })
  it('preserves names and parameters while translating interface templates', () => {
    expect(uiTextFor('en','Удалить «{0}»?', 'Мактаби Рӯдакӣ')).toBe('Delete “Мактаби Рӯдакӣ”?')
    expect(uiTextFor('tg','Результаты: {0}', 'Математика')).toBe('Натиҷаҳо: Математика')
    expect(uiTextFor('en','Логин: {0}\nПароль: {1}','student','pass')).toBe('Username: student\nPassword: pass')
    expect(uiTextFor('ru','Новая школа')).toBe('Новая школа')
  })
  it('keeps stored category and job identifiers independent of the selected language', () => {
    useLangStore.getState().setLang('en')
    expect(toRussianCategory('SALARIES')).toBe('Зарплата сотрудников')
    expect(toBackendCategory(toRussianCategory('RENT'))).toBe('RENT')
    expect(toRussianPosition('HEAD_MASTER')).toBe('Заведующий')
    expect(toBackendPosition(toRussianPosition('NURSE'))).toBe('NURSE')
    expect(uiText(toRussianPosition('NURSE'))).toBe('Nurse')
  })
  it('localizes calendars and automatic form validation for Tajik', () => {
    const locale = antdLocale('tg')
    expect(locale.DatePicker?.lang.today).toBe('Имрӯз')
    expect(locale.DatePicker?.lang.placeholder).toBe('Санаро интихоб кунед')
    expect(locale.Form?.defaultValidateMessages?.required).toBe('${label}-ро ворид кунед')
  })
})
