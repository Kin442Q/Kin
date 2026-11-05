import { describe, it, expect } from 'vitest'
import { orderForSave, sameSelection, toggleId, toggleMany } from './teacherAccess'

describe('toggleId', () => {
  it('добавляет и убирает класс, не меняя исходный набор', () => {
    const a = new Set(['1'])
    const b = toggleId(a, '2')
    expect([...b].sort()).toEqual(['1', '2'])
    expect([...a]).toEqual(['1'])
    expect([...toggleId(b, '1')]).toEqual(['2'])
  })
})

describe('toggleMany', () => {
  it('выбирает всю параллель, если выбрана не вся', () => {
    const r = toggleMany(new Set(['a1']), ['a1', 'a2', 'a3'])
    expect([...r].sort()).toEqual(['a1', 'a2', 'a3'])
  })

  it('снимает всю параллель, если выбрана целиком, не трогая чужие классы', () => {
    const r = toggleMany(new Set(['a1', 'a2', 'b1']), ['a1', 'a2'])
    expect([...r]).toEqual(['b1'])
  })

  it('пустая параллель ничего не меняет', () => {
    expect([...toggleMany(new Set(['x']), [])]).toEqual(['x'])
  })
})

describe('sameSelection', () => {
  it('сравнивает наборы без учёта порядка', () => {
    expect(sameSelection(new Set(['1', '2']), new Set(['2', '1']))).toBe(true)
    expect(sameSelection(new Set(['1']), new Set(['1', '2']))).toBe(false)
    expect(sameSelection(new Set(), new Set())).toBe(true)
  })
})

describe('orderForSave', () => {
  const school = ['g1', 'g2', 'g3', 'g4']

  it('без основного класса — в порядке списка школы', () => {
    expect(orderForSave(new Set(['g3', 'g1']), school, null)).toEqual(['g1', 'g3'])
  })

  it('основной класс, если он выбран, идёт первым', () => {
    expect(orderForSave(new Set(['g1', 'g3', 'g4']), school, 'g3')).toEqual(['g3', 'g1', 'g4'])
  })

  it('основной класс, с которого сняли доступ, не попадает в список', () => {
    expect(orderForSave(new Set(['g2', 'g4']), school, 'g1')).toEqual(['g2', 'g4'])
  })

  it('пустой выбор — пустой список (доступ снят)', () => {
    expect(orderForSave(new Set(), school, 'g1')).toEqual([])
  })
})
