import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage, uid } from './useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear())

  it('возвращает initialValue, если в хранилище пусто', () => {
    const { result } = renderHook(() => useLocalStorage('k1', 'def'))
    expect(result.current[0]).toBe('def')
  })

  it('читает существующее значение из localStorage', () => {
    localStorage.setItem('k2', JSON.stringify('saved'))
    const { result } = renderHook(() => useLocalStorage('k2', 'def'))
    expect(result.current[0]).toBe('saved')
  })

  it('записывает значение в localStorage при изменении', () => {
    const { result } = renderHook(() => useLocalStorage('k3', 0))
    act(() => result.current[1](42))
    expect(result.current[0]).toBe(42)
    expect(JSON.parse(localStorage.getItem('k3')!)).toBe(42)
  })

  it('битый JSON в хранилище → initialValue без падения', () => {
    localStorage.setItem('k4', '{не json')
    const { result } = renderHook(() => useLocalStorage('k4', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('работает с объектами', () => {
    const { result } = renderHook(() =>
      useLocalStorage('k5', { a: 1 } as { a: number }),
    )
    act(() => result.current[1]({ a: 2 }))
    expect(result.current[0]).toEqual({ a: 2 })
  })
})

describe('uid', () => {
  it('генерирует непустую строку', () => {
    expect(uid().length).toBeGreaterThan(0)
  })
  it('уникален при последовательных вызовах', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()))
    expect(ids.size).toBe(100)
  })
})
