import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLabels } from './useLabels'
import { useAuthStore } from '../store/authStore'
import type { User } from '../types'

const baseUser: User = {
  id: 'u1',
  fullName: 'Тест',
  email: 't@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
}

describe('useLabels', () => {
  beforeEach(() => useAuthStore.setState({ user: null, token: null }))

  it('без пользователя — садиковые лейблы', () => {
    const { result } = renderHook(() => useLabels())
    expect(result.current.group).toBe('группа')
  })

  it('SCHOOL institution → школьные лейблы', () => {
    useAuthStore.setState({
      user: {
        ...baseUser,
        institution: { id: 'k1', name: 'Школа №1', type: 'SCHOOL' },
      },
      token: 't',
    })
    const { result } = renderHook(() => useLabels())
    expect(result.current.group).toBe('класс')
    expect(result.current.student).toBe('ученик')
  })

  it('KINDERGARTEN institution → садиковые лейблы', () => {
    useAuthStore.setState({
      user: {
        ...baseUser,
        institution: { id: 'k1', name: 'Садик', type: 'KINDERGARTEN' },
      },
      token: 't',
    })
    const { result } = renderHook(() => useLabels())
    expect(result.current.teacher).toBe('воспитатель')
  })
})
