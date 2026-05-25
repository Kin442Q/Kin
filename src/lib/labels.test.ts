import { describe, it, expect } from 'vitest'
import { labels, cap } from './labels'

describe('labels', () => {
  it('садиковые лейблы по умолчанию (нет типа)', () => {
    const l = labels()
    expect(l.group).toBe('группа')
    expect(l.student).toBe('ребёнок')
    expect(l.teacher).toBe('воспитатель')
    expect(l.institution).toBe('садик')
  })

  it('садиковые при KINDERGARTEN', () => {
    expect(labels('KINDERGARTEN').groups).toBe('Группы')
  })

  it('школьные при SCHOOL', () => {
    const l = labels('SCHOOL')
    expect(l.group).toBe('класс')
    expect(l.student).toBe('ученик')
    expect(l.teacher).toBe('учитель')
    expect(l.groups).toBe('Классы')
    expect(l.institution).toBe('школа')
  })

  it('null трактуется как садик', () => {
    expect(labels(null).group).toBe('группа')
  })

  it('родитель одинаков в обоих типах', () => {
    expect(labels('SCHOOL').parent).toBe('родитель')
    expect(labels('KINDERGARTEN').parent).toBe('родитель')
  })
})

describe('cap', () => {
  it('капитализирует первую букву', () => {
    expect(cap('класс')).toBe('Класс')
    expect(cap('ребёнок')).toBe('Ребёнок')
  })
  it('пустую строку не ломает', () => {
    expect(cap('')).toBe('')
  })
  it('уже заглавную оставляет', () => {
    expect(cap('Школа')).toBe('Школа')
  })
})
