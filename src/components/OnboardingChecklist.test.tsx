import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const get = vi.fn()
vi.mock('../api', () => ({ http: { get: (...a: unknown[]) => get(...a) } }))

import OnboardingChecklist from './OnboardingChecklist'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import type { User } from '../types'

const admin: User = {
  id: 'a1',
  fullName: 'Админ',
  email: 'a@kg.tj',
  role: 'ADMIN',
  kindergartenId: 'k1',
  institution: { id: 'k1', name: 'Садик', type: 'KINDERGARTEN' },
}

function renderCl() {
  return render(
    <MemoryRouter>
      <OnboardingChecklist />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: [] }) // нет учителей
  localStorage.clear()
  useAuthStore.setState({ user: null, token: null })
  useDataStore.setState({ groups: [], children: [] } as never)
})

describe('OnboardingChecklist', () => {
  it('не рендерится для не-админа', () => {
    useAuthStore.setState({
      user: { ...admin, role: 'PARENT' },
      token: 't',
    })
    const { container } = renderCl()
    expect(container).toBeEmptyDOMElement()
  })

  it('не рендерится для владельца без учреждения', () => {
    useAuthStore.setState({
      user: { ...admin, role: 'SUPER_ADMIN', kindergartenId: null },
      token: 't',
    })
    const { container } = renderCl()
    expect(container).toBeEmptyDOMElement()
  })

  it('показывает 0 из 4 шагов для пустого учреждения', async () => {
    useAuthStore.setState({ user: admin, token: 't' })
    renderCl()
    await waitFor(() =>
      expect(screen.getByText(/Готово 0 из 4 шагов/)).toBeInTheDocument(),
    )
  })

  it('засчитывает шаги по данным (гео + группы + дети + учителя)', async () => {
    useAuthStore.setState({
      user: {
        ...admin,
        institution: {
          id: 'k1',
          name: 'Садик',
          type: 'KINDERGARTEN',
          latitude: 38.5,
          longitude: 68.7,
        },
      },
      token: 't',
    })
    useDataStore.setState({
      groups: [{ id: 'g1', name: '1А' }],
      children: [{ id: 'c1' }],
    } as never)
    get.mockResolvedValue({ data: [{ id: 't1' }] }) // есть учитель

    renderCl()
    await waitFor(() =>
      expect(screen.getByText(/Учреждение настроено/)).toBeInTheDocument(),
    )
  })

  it('не показывается, если настройка ранее завершена (localStorage)', () => {
    localStorage.setItem('onboarding_done_k1', '1')
    useAuthStore.setState({ user: admin, token: 't' })
    const { container } = renderCl()
    expect(container).toBeEmptyDOMElement()
  })
})
