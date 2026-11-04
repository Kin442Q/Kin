import { describe, it, expect } from 'vitest'
import {
  parseClassName,
  gradeKeyOf,
  compareClassNames,
  groupByGrade,
  compactClassName,
  classLetterOf,
  findClassByName,
  plural,
} from './classes'

describe('parseClassName', () => {
  it('разбирает параллель и букву в разных написаниях', () => {
    expect(parseClassName('1 А')).toEqual({ grade: 1, letter: 'А' })
    expect(parseClassName('1А')).toEqual({ grade: 1, letter: 'А' })
    expect(parseClassName('11b')).toEqual({ grade: 11, letter: 'B' })
    expect(parseClassName('3 V')).toEqual({ grade: 3, letter: 'V' })
    expect(parseClassName('5-Б')).toEqual({ grade: 5, letter: 'Б' })
  })

  it('название без номера — без параллели', () => {
    expect(parseClassName('Кружок')).toEqual({ grade: null, letter: 'КРУЖОК' })
    expect(gradeKeyOf('Кружок')).toBe('other')
  })
})

describe('groupByGrade', () => {
  const names = ['11b', '1 A', '1 B', '3 V', '2 A', '2 B', '2 V', '3 A', '3 B', 'Кружок']
  const groups = groupByGrade(names, (n) => n)

  it('параллели идут по возрастанию, «другие» в конце', () => {
    expect(groups.map((g) => g.label)).toEqual(['1 класс', '2 класс', '3 класс', '11 класс', 'Другие классы'])
  })

  it('классы внутри параллели отсортированы по букве', () => {
    expect(groups[0].items).toEqual(['1 A', '1 B'])
    expect(groups[1].items).toEqual(['2 A', '2 B', '2 V'])
    expect(groups[2].items).toEqual(['3 A', '3 B', '3 V'])
  })

  it('11 идёт после 3, а не после 1', () => {
    expect(compareClassNames('11b', '3 A')).toBeGreaterThan(0)
  })
})

describe('compactClassName / classLetterOf', () => {
  it('«1 А» → «1А»', () => {
    expect(compactClassName('1 А')).toBe('1А')
    expect(compactClassName('11 б')).toBe('11Б')
  })
  it('буква для плашки', () => {
    expect(classLetterOf('2 Б')).toBe('Б')
    expect(classLetterOf('Кружок')).toBe('КРУЖОК')
  })
})

describe('findClassByName', () => {
  const groups = [{ name: '1 A', id: 'a' }, { name: '1 B', id: 'b' }, { name: '1 V', id: 'v' }, { name: '11 Г', id: 'g' }]

  it('находит класс независимо от пробелов и регистра', () => {
    expect(findClassByName(groups, '1a')?.id).toBe('a')
    expect(findClassByName(groups, ' 1 A ')?.id).toBe('a')
  })

  it('кириллица совпадает с латиницей по транслитерации: А=A, Б=B, В=V', () => {
    expect(findClassByName(groups, '1 А')?.id).toBe('a')
    expect(findClassByName(groups, '1 Б')?.id).toBe('b')
    expect(findClassByName(groups, '1 В')?.id).toBe('v')
  })

  it('кириллическая «Г» находит такую же', () => {
    expect(findClassByName(groups, '11 Г')?.id).toBe('g')
  })

  it('неизвестный или пустой класс — не находит', () => {
    expect(findClassByName(groups, '9 Д')).toBeUndefined()
    expect(findClassByName(groups, '')).toBeUndefined()
    expect(findClassByName(groups, undefined)).toBeUndefined()
  })
})

describe('plural', () => {
  it('склоняет «класс»', () => {
    const f: [string, string, string] = ['класс', 'класса', 'классов']
    expect([1, 2, 5, 11, 21, 24].map((n) => plural(n, f))).toEqual([
      'класс', 'класса', 'классов', 'классов', 'класс', 'класса',
    ])
  })
})
