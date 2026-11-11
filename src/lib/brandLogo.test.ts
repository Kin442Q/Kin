import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { brandLogoSrc, useBrandLogo, warmBrandLogos } from './brandLogo'

describe('brandLogoSrc', () => {
  it('файл по языку и теме', () => {
    expect(brandLogoSrc('ru', false)).toMatch(/brand\/logo-ru\.svg$/)
    expect(brandLogoSrc('en', true)).toMatch(/brand\/logo-en-dark\.svg$/)
    expect(brandLogoSrc('tg', false)).toMatch(/brand\/logo-tg\.svg$/)
  })
})

describe('warmBrandLogos', () => {
  const created: string[] = []
  const RealImage = globalThis.Image

  beforeEach(() => {
    created.length = 0
    class FakeImage {
      set src(value: string) {
        created.push(value)
      }
    }
    // @ts-expect-error подмена конструктора для проверки
    globalThis.Image = FakeImage
  })
  afterEach(() => {
    globalThis.Image = RealImage
  })

  it('подгружает все шесть логотипов (3 языка × 2 темы) и только один раз', async () => {
    // модуль хранит флаг «уже грузили» — берём свежую копию
    vi.resetModules()
    const fresh = await import('./brandLogo')
    fresh.warmBrandLogos()
    fresh.warmBrandLogos()
    expect(created).toHaveLength(6)
    expect(new Set(created).size).toBe(6)
    expect(created.some((u) => u.endsWith('logo-tg-dark.svg'))).toBe(true)
  })
})

describe('useBrandLogo', () => {
  it('сначала логотип выбранного языка', () => {
    const { result } = renderHook(() => useBrandLogo('en', false))
    expect(result.current.src).toMatch(/logo-en\.svg$/)
  })

  it('не загрузился — показываем русский, а не сломанную картинку', () => {
    const { result } = renderHook(() => useBrandLogo('en', true))
    act(() => result.current.onError())
    expect(result.current.src).toMatch(/logo-ru-dark\.svg$/)
  })

  it('отказ не «залипает»: на другом языке файл пробуется заново', () => {
    const { result, rerender } = renderHook(({ lang }: { lang: 'ru' | 'en' | 'tg' }) => useBrandLogo(lang, false), {
      initialProps: { lang: 'en' as 'ru' | 'en' | 'tg' },
    })
    act(() => result.current.onError())
    expect(result.current.src).toMatch(/logo-ru\.svg$/)
    rerender({ lang: 'tg' })
    expect(result.current.src).toMatch(/logo-tg\.svg$/)
    // и если русский сам не грузится — адрес не меняется, зацикливания нет
    rerender({ lang: 'ru' })
    act(() => result.current.onError())
    expect(result.current.src).toMatch(/logo-ru\.svg$/)
  })
})

// warmBrandLogos импортирован, чтобы проверка типов видела экспорт
void warmBrandLogos
