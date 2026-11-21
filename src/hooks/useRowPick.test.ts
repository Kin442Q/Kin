import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRowPick } from './useRowPick'

const rows = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: `s${from + i}` }))

describe('useRowPick — выделение строк', () => {
  it('сначала ничего не выбрано', () => {
    const { result } = renderHook(() => useRowPick(rows(3), 'a'))
    expect(result.current.picked).toEqual([])
    expect(result.current.allPicked).toBe(false)
    expect(result.current.somePicked).toBe(false)
  })

  it('выбрать одного: он выбран, «выбраны не все» (частичная галочка в шапке)', () => {
    const { result } = renderHook(() => useRowPick(rows(3), 'a'))
    act(() => result.current.toggle('s2', true))
    expect(result.current.pickedIds).toEqual(['s2'])
    expect(result.current.somePicked).toBe(true)
    expect(result.current.allPicked).toBe(false)
  })

  it('снять галочку с одного', () => {
    const { result } = renderHook(() => useRowPick(rows(3), 'a'))
    act(() => result.current.toggle('s1', true))
    act(() => result.current.toggle('s2', true))
    act(() => result.current.toggle('s1', false))
    expect(result.current.pickedIds).toEqual(['s2'])
  })

  it('выбрать всех: берёт все найденные строки, а не только страницу', () => {
    const found = rows(37)
    const { result } = renderHook(() => useRowPick(found, 'a'))
    act(() => result.current.toggleAll(true))
    expect(result.current.picked).toHaveLength(37)
    expect(result.current.allPicked).toBe(true)
    expect(result.current.somePicked).toBe(false)
  })

  it('галочка «все» выключена: снимает всё', () => {
    const { result } = renderHook(() => useRowPick(rows(5), 'a'))
    act(() => result.current.toggleAll(true))
    act(() => result.current.toggleAll(false))
    expect(result.current.picked).toEqual([])
  })

  it('«снять выделение» очищает', () => {
    const { result } = renderHook(() => useRowPick(rows(5), 'a'))
    act(() => result.current.toggleAll(true))
    act(() => result.current.clear())
    expect(result.current.picked).toEqual([])
  })

  it('смена фильтра (resetKey) сбрасывает выделение', () => {
    const found = rows(5)
    const { result, rerender } = renderHook(({ k }) => useRowPick(found, k), { initialProps: { k: 'a' } })
    act(() => result.current.toggleAll(true))
    expect(result.current.picked).toHaveLength(5)
    rerender({ k: 'b' })
    expect(result.current.picked).toEqual([])
    // и после возврата к прежнему фильтру выделение не воскресает
    rerender({ k: 'a' })
    expect(result.current.picked).toEqual([])
  })

  it('выбранными считаются только показанные строки: спрятанных нет в выделении', () => {
    const { result, rerender } = renderHook(({ list }) => useRowPick(list, 'a'), {
      initialProps: { list: rows(4) },
    })
    act(() => result.current.toggleAll(true))
    // в списке остались только s2 и s3 (например, обновление данных)
    rerender({ list: [{ id: 's2' }, { id: 's3' }] })
    expect(result.current.pickedIds).toEqual(['s2', 's3'])
    expect(result.current.allPicked).toBe(true)
  })

  it('пустой список: «все выбраны» ложно', () => {
    const { result } = renderHook(() => useRowPick([], 'a'))
    act(() => result.current.toggleAll(true))
    expect(result.current.allPicked).toBe(false)
    expect(result.current.picked).toEqual([])
  })

  it('без прав (enabled = false) выделения нет, даже если его пытаются создать', () => {
    const { result } = renderHook(() => useRowPick(rows(5), 'a', false))
    act(() => result.current.toggleAll(true))
    act(() => result.current.toggle('s1', true))
    expect(result.current.picked).toEqual([])
    expect(result.current.pickedIds).toEqual([])
  })
})
