import { describe, it, expect } from 'vitest'
import {
  toBackendCategory,
  toRussianCategory,
  CATEGORY_TO_ENUM,
  ENUM_TO_CATEGORY,
} from './expenseCategoryMap'

describe('expenseCategoryMap', () => {
  it('маппинг русский → enum', () => {
    expect(toBackendCategory('Зарплата сотрудников')).toBe('SALARIES')
    expect(toBackendCategory('Налоги')).toBe('TAXES')
    expect(toBackendCategory('Питание')).toBe('FOOD')
    expect(toBackendCategory('Аренда помещения')).toBe('RENT')
  })

  it('неизвестная категория → OTHER', () => {
    expect(toBackendCategory('Неизвестная категория')).toBe('OTHER')
    expect(toBackendCategory('')).toBe('OTHER')
  })

  it('маппинг enum → русский', () => {
    expect(toRussianCategory('SALARIES')).toBe('Зарплата сотрудников')
    expect(toRussianCategory('FOOD')).toBe('Питание')
    expect(toRussianCategory('OTHER')).toBe('Прочее')
  })

  it('неизвестный enum → Прочее', () => {
    expect(toRussianCategory('UNKNOWN_VALUE')).toBe('Прочее')
  })

  it('round-trip: RU → enum → RU', () => {
    Object.keys(CATEGORY_TO_ENUM).forEach((ru) => {
      const enumVal = toBackendCategory(ru)
      expect(toRussianCategory(enumVal)).toBe(ru)
    })
  })

  it('round-trip: enum → RU → enum', () => {
    Object.keys(ENUM_TO_CATEGORY).forEach((en) => {
      const ru = toRussianCategory(en)
      expect(toBackendCategory(ru)).toBe(en)
    })
  })
})
