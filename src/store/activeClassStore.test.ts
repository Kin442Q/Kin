import { describe, it, expect, beforeEach } from 'vitest'
import { useActiveClassStore } from './activeClassStore'

describe('activeClassStore', () => {
  beforeEach(() => {
    useActiveClassStore.setState({ activeClassId: null })
  })

  it('по умолчанию активный класс null', () => {
    expect(useActiveClassStore.getState().activeClassId).toBeNull()
  })

  it('setActiveClass задаёт класс', () => {
    useActiveClassStore.getState().setActiveClass('g1')
    expect(useActiveClassStore.getState().activeClassId).toBe('g1')
  })

  it('setActiveClass(null) сбрасывает', () => {
    useActiveClassStore.getState().setActiveClass('g1')
    useActiveClassStore.getState().setActiveClass(null)
    expect(useActiveClassStore.getState().activeClassId).toBeNull()
  })
})
