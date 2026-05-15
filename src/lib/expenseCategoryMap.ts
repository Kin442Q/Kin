/**
 * Сопоставление русских названий категорий (UI) и enum значений бекенда.
 */

export type ExpenseCategoryEnum =
  | 'SALARIES'
  | 'TAXES'
  | 'RENT'
  | 'UTILITIES'
  | 'FOOD'
  | 'TOYS'
  | 'STATIONERY'
  | 'INTERNET'
  | 'CLEANING'
  | 'REPAIRS'
  | 'EDUCATION'
  | 'OTHER'

export const CATEGORY_TO_ENUM: Record<string, ExpenseCategoryEnum> = {
  'Зарплата сотрудников': 'SALARIES',
  Налоги: 'TAXES',
  'Аренда помещения': 'RENT',
  'Коммунальные услуги': 'UTILITIES',
  Питание: 'FOOD',
  'Игрушки и инвентарь': 'TOYS',
  'Учебные материалы': 'EDUCATION',
  Канцелярия: 'STATIONERY',
  'Интернет и связь': 'INTERNET',
  'Уборка и хозтовары': 'CLEANING',
  'Ремонт и обслуживание': 'REPAIRS',
  Прочее: 'OTHER',
}

export const ENUM_TO_CATEGORY: Record<ExpenseCategoryEnum, string> = {
  SALARIES: 'Зарплата сотрудников',
  TAXES: 'Налоги',
  RENT: 'Аренда помещения',
  UTILITIES: 'Коммунальные услуги',
  FOOD: 'Питание',
  TOYS: 'Игрушки и инвентарь',
  EDUCATION: 'Учебные материалы',
  STATIONERY: 'Канцелярия',
  INTERNET: 'Интернет и связь',
  CLEANING: 'Уборка и хозтовары',
  REPAIRS: 'Ремонт и обслуживание',
  OTHER: 'Прочее',
}

export function toBackendCategory(ru: string): ExpenseCategoryEnum {
  return CATEGORY_TO_ENUM[ru] || 'OTHER'
}

export function toRussianCategory(en: string): string {
  return ENUM_TO_CATEGORY[en as ExpenseCategoryEnum] || 'Прочее'
}
