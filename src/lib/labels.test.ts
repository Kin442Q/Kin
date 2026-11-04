import { describe, it, expect } from 'vitest'
import { labels, cap } from './labels'

describe('labels', () => {
  it('платформа только для школ: класс, ученик, учитель', () => {
    const l = labels()
    expect(l.group).toBe('класс')
    expect(l.groups).toBe('Классы')
    expect(l.inGroup).toBe('в класс')
    expect(l.student).toBe('ученик')
    expect(l.students).toBe('Ученики')
    expect(l.teacher).toBe('учитель')
    expect(l.teachers).toBe('Учителя')
    expect(l.institution).toBe('школа')
    expect(l.parent).toBe('родитель')
  })

  it('в подписях нет садиковых слов', () => {
    const all = Object.values(labels()).join(' ').toLowerCase()
    for (const word of ['садик', 'групп', 'ребён', 'воспитател', 'дети']) {
      expect(all).not.toContain(word)
    }
  })
})

describe('cap', () => {
  it('капитализирует первую букву', () => {
    expect(cap('класс')).toBe('Класс')
    expect(cap('ученик')).toBe('Ученик')
  })
  it('пустую строку не ломает', () => {
    expect(cap('')).toBe('')
  })
  it('уже заглавную оставляет', () => {
    expect(cap('Школа')).toBe('Школа')
  })
})
