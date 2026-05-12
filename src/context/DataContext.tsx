// Устаревший контекст. Оставлен как тонкий адаптер: useData() возвращает
// текущее состояние из zustand-стора. Новые страницы должны импортировать
// useDataStore напрямую.
import { ReactNode } from 'react'
import { useDataStore } from '../store/dataStore'

export function DataProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useData() {
  return useDataStore()
}
