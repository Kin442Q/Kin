import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from './themeStore'

describe('themeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'light' })
    document.documentElement.removeAttribute('data-theme')
  })

  it('по умолчанию light', () => {
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('toggle переключает light ↔ dark', () => {
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().mode).toBe('dark')
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('toggle ставит data-theme на <html>', () => {
    useThemeStore.getState().toggle()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('setMode задаёт конкретную тему и атрибут', () => {
    useThemeStore.getState().setMode('dark')
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
