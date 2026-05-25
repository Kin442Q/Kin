import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const get = vi.fn()
vi.mock('../api', () => ({ http: { get: (...a: unknown[]) => get(...a) } }))

import { useTenantSync } from './useTenantSync'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import type { User } from '../types'

const admin: User = {
  id: 'admin-1',
  fullName: 'Админ',
  email: 'a@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
}

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: [] })
  useAuthStore.setState({ user: null, token: null })
})

describe('useTenantSync', () => {
  it('админ грузит /v1/groups и /v1/students', async () => {
    useAuthStore.setState({ user: admin, token: 't' })
    renderHook(() => useTenantSync())
    await waitFor(() => expect(get).toHaveBeenCalledWith('/v1/groups'))
    expect(get).toHaveBeenCalledWith('/v1/students')
  })

  it('родитель НЕ дёргает groups/students (нет прав)', async () => {
    useAuthStore.setState({
      user: { ...admin, id: 'p1', role: 'PARENT', childId: 'c1' },
      token: 't',
    })
    renderHook(() => useTenantSync())
    // даём эффекту отработать
    await new Promise((r) => setTimeout(r, 20))
    expect(get).not.toHaveBeenCalled()
    expect(useDataStore.getState().groups).toEqual([])
  })

  it('супер-админ без садика ничего не грузит', async () => {
    useAuthStore.setState({
      user: { ...admin, id: 'su', role: 'SUPER_ADMIN', kindergartenId: null },
      token: 't',
    })
    renderHook(() => useTenantSync())
    await new Promise((r) => setTimeout(r, 20))
    expect(get).not.toHaveBeenCalled()
  })
})
