import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAuth from './RequireAuth'
import { useAuthStore } from '../../store/authStore'

function renderRoute(initialPath = '/private') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>LoginPage</div>} />
        <Route
          path="/private"
          element={
            <RequireAuth>
              <div>SecretContent</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('<RequireAuth>', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null })
  })

  it('редиректит на /login если не залогинен', () => {
    renderRoute()
    expect(screen.getByText('LoginPage')).toBeInTheDocument()
    expect(screen.queryByText('SecretContent')).not.toBeInTheDocument()
  })

  it('пускает залогиненного', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        fullName: 'Test',
        email: 'a@b.c',
        role: 'ADMIN',
      },
      token: 'jwt',
    })
    renderRoute()
    expect(screen.getByText('SecretContent')).toBeInTheDocument()
    expect(screen.queryByText('LoginPage')).not.toBeInTheDocument()
  })
})
