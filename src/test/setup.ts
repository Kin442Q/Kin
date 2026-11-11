import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Use browser-like storage in jsdom instead of Node's optional filesystem storage.
const storageData = new Map<string, string>()
const storage: Storage = {
  get length() { return storageData.size },
  clear: () => storageData.clear(),
  getItem: key => storageData.get(String(key)) ?? null,
  key: index => [...storageData.keys()][index] ?? null,
  removeItem: key => { storageData.delete(String(key)) },
  setItem: (key, value) => { storageData.set(String(key), String(value)) },
}
Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

// Чистим DOM после каждого теста
afterEach(() => {
  cleanup()
})

// Мокаем window.matchMedia (Ant Design его использует)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Мокаем ResizeObserver (для антд-таблиц)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver = MockResizeObserver
