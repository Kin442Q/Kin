import { describe, it, expect } from 'vitest'
import { uid } from './uid'

describe('uid', () => {
  it('возвращает непустую строку', () => {
    expect(uid()).toBeTruthy()
    expect(typeof uid()).toBe('string')
  })

  it('генерирует уникальные значения', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(uid())
    }
    // 100 вызовов → 100 разных id
    expect(ids.size).toBe(100)
  })

  it('длина около 12 символов', () => {
    const id = uid()
    expect(id.length).toBeGreaterThanOrEqual(10)
    expect(id.length).toBeLessThanOrEqual(14)
  })
})
