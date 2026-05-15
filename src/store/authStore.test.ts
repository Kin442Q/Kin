import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import { useDataStore } from './dataStore'
import type { User } from '../types'

const sampleUser: User = {
  id: 'u1',
  fullName: 'Иван Иванов',
  email: 'admin@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
}

describe('authStore', () => {
  beforeEach(() => {
    // Сбрасываем стор перед каждым тестом
    useAuthStore.setState({ user: null, token: null })
  })

  it('начальное состояние — null', () => {
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('login сохраняет user + token', () => {
    useAuthStore.getState().login(sampleUser, 'jwt-token')
    expect(useAuthStore.getState().user).toEqual(sampleUser)
    expect(useAuthStore.getState().token).toBe('jwt-token')
  })

  it('login использует дефолтный token если не передан', () => {
    useAuthStore.getState().login(sampleUser)
    expect(useAuthStore.getState().token).toBe('demo-token')
  })

  it('logout сбрасывает user + token', () => {
    useAuthStore.getState().login(sampleUser, 'jwt-token')
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('hasRole корректно проверяет роль', () => {
    useAuthStore.getState().login(sampleUser)
    expect(useAuthStore.getState().hasRole('ADMIN')).toBe(true)
    expect(useAuthStore.getState().hasRole('TEACHER')).toBe(false)
    expect(useAuthStore.getState().hasRole('ADMIN', 'TEACHER')).toBe(true)
  })

  it('hasRole возвращает false если не залогинен', () => {
    expect(useAuthStore.getState().hasRole('ADMIN')).toBe(false)
  })

  it('login другого пользователя очищает локальные данные', async () => {
    // Заполняем стор данными
    useDataStore.getState().setGroups([
      {
        id: 'g1',
        name: 'Test',
        ageRange: '3-4',
        monthlyFee: 1000,
        fixedMonthlyExpense: 5000,
        color: '#fff',
        createdAt: '2026-01-01',
      },
    ])

    expect(useDataStore.getState().groups).toHaveLength(1)

    // Входим первым пользователем
    useAuthStore.getState().login(sampleUser, 't1')

    // Ждём динамический импорт
    await new Promise((r) => setTimeout(r, 50))

    // Входим другим пользователем
    useAuthStore.getState().login(
      { ...sampleUser, id: 'u2', email: 'other@kg.tj' },
      't2',
    )

    await new Promise((r) => setTimeout(r, 50))

    // Локальный стор очистился
    expect(useDataStore.getState().groups).toHaveLength(0)
  })
})
