import { describe, it, expect, beforeEach } from 'vitest'
import { ru } from './ru'
import { en } from './en'
import { tg } from './tg'
import type { Msg } from './types'
import { pluralCategory, translate, translateRich, useLangStore, LANGS } from './index'

const placeholders = (m: Msg): string[] => {
  const forms = typeof m === 'string' ? [m] : Object.values(m)
  const sets = forms.map((s) => [...new Set((s ?? '').match(/\{\w+\}/g) ?? [])].sort().join(','))
  return [...new Set(sets)]
}

describe('словари', () => {
  const keys = Object.keys(ru)

  it('в английском и таджикском те же ключи, что в русском', () => {
    expect(Object.keys(en).sort()).toEqual([...keys].sort())
    expect(Object.keys(tg).sort()).toEqual([...keys].sort())
  })

  it('подстановки {…} в переводах те же, что в русском тексте', () => {
    for (const k of keys as (keyof typeof ru)[]) {
      const base = placeholders(ru[k] as Msg)
      expect(base.length, `ru ${k}: формы с разными подстановками`).toBe(1)
      expect(placeholders(en[k]), `en ${k}`).toEqual(base)
      expect(placeholders(tg[k]), `tg ${k}`).toEqual(base)
    }
  })

  it('нет пустых переводов', () => {
    for (const dict of [ru, en, tg] as Record<string, Msg>[]) {
      for (const [k, v] of Object.entries(dict)) {
        const forms = typeof v === 'string' ? [v] : Object.values(v)
        for (const f of forms) expect(f && f.trim().length, k).toBeGreaterThan(0)
      }
    }
  })
})

describe('склонение', () => {
  it('русский: 1 класс, 2 класса, 5 классов, 11 классов, 21 класс, 112 классов', () => {
    const cat = (n: number) => pluralCategory('ru', n)
    expect([1, 2, 5, 11, 21, 22, 25, 111, 112].map(cat)).toEqual([
      'one', 'few', 'many', 'many', 'one', 'few', 'many', 'many', 'many',
    ])
  })

  it('translate выбирает форму по n', () => {
    expect(translate('ru', 'dash.classes.count', { n: 1 })).toBe('1 класс')
    expect(translate('ru', 'dash.classes.count', { n: 3 })).toBe('3 класса')
    expect(translate('ru', 'dash.classes.count', { n: 7 })).toBe('7 классов')
    expect(translate('en', 'dash.classes.count', { n: 1 })).toBe('1 class')
    expect(translate('en', 'dash.classes.count', { n: 2 })).toBe('2 classes')
    expect(translate('tg', 'dash.classes.count', { n: 5 })).toBe('5 синф')
  })
})

describe('подстановки', () => {
  it('подставляет именованные значения и оставляет неизвестные как есть', () => {
    expect(translate('en', 'login.welcome', { name: 'Малика' })).toBe('Welcome, Малика')
    expect(translate('ru', 'login.welcome')).toBe('Добро пожаловать, {name}')
  })

  it('rich: вставляет React-узлы на место {a} и {b}', () => {
    const nodes = translateRich('en', 'dash.fin.per100', { a: 'A', b: 'B' })
    expect(nodes.map((n) => (typeof n === 'string' ? n : '·')).join('')).toBe('Out of every · of income, · remains as profit.')
  })
})

describe('хранилище языка', () => {
  beforeEach(() => {
    localStorage.clear()
    useLangStore.getState().setLang('ru')
  })

  it('по умолчанию русский', () => {
    expect(useLangStore.getState().lang).toBe('ru')
  })

  it('смена языка ставит атрибут lang у <html> и язык дат', () => {
    for (const l of LANGS) {
      useLangStore.getState().setLang(l.code)
      expect(document.documentElement.getAttribute('lang')).toBe(l.htmlLang)
    }
  })

  it('выбор запоминается в localStorage', () => {
    useLangStore.getState().setLang('tg')
    expect(JSON.parse(localStorage.getItem('kg_lang') ?? '{}').state.lang).toBe('tg')
  })
})
