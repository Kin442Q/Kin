import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLabels } from './useLabels'
import { useAuthStore } from '../store/authStore'

describe('useLabels', () => {
  beforeEach(() => useAuthStore.setState({ user: null, token: null }))

  it('без пользователя — школьные подписи', () => {
    const { result } = renderHook(() => useLabels())
    expect(result.current.group).toBe('класс')
    expect(result.current.student).toBe('ученик')
  })

  it('и для вошедшего пользователя подписи школьные, что бы ни хранилось в учреждении', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        fullName: 'Тест',
        email: 't@s.tj',
        role: 'ADMIN',
        kindergartenId: 'k1',
        // старые данные из localStorage могут содержать KINDERGARTEN
        institution: { id: 'k1', name: 'Школа', type: 'KINDERGARTEN' } as never,
      },
      token: 't',
    })
    const { result } = renderHook(() => useLabels())
    expect(result.current.groups).toBe('Классы')
  })
})
