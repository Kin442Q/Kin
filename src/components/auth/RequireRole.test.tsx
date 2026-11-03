import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import RequireRole from './RequireRole'
import { useAuthStore } from '../../store/authStore'

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ConfigProvider>{ui}</ConfigProvider>
    </MemoryRouter>,
  )

describe('<RequireRole>', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null })
  })

  it('возвращает null если не залогинен', () => {
    const { container } = wrap(
      <RequireRole roles={['ADMIN']}>
        <div>Secret</div>
      </RequireRole>,
    )
    expect(container.textContent).toBe('')
  })

  it('пускает с подходящей ролью', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        fullName: 'A',
        email: 'a@b.c',
        role: 'ADMIN',
      },
      token: 'jwt',
    })

    wrap(
      <RequireRole roles={['ADMIN', 'SUPER_ADMIN']}>
        <div>Secret</div>
      </RequireRole>,
    )

    expect(screen.getByText('Secret')).toBeInTheDocument()
  })

  it('показывает 403 для роли вне списка', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        fullName: 'A',
        email: 'a@b.c',
        role: 'TEACHER',
      },
      token: 'jwt',
    })

    wrap(
      <RequireRole roles={['ADMIN', 'SUPER_ADMIN']}>
        <div>Secret</div>
      </RequireRole>,
    )

    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
    expect(screen.getByText(/Нет доступа/)).toBeInTheDocument()
  })

  describe('раздел платформы (feature)', () => {
    const admin = (features?: string[], kindergartenId: string | null = 'k1') => ({
      id: 'u1',
      fullName: 'A',
      email: 'a@b.c',
      role: 'ADMIN' as const,
      kindergartenId,
      features,
    })

    it('пускает, если раздел включён для учреждения', () => {
      useAuthStore.setState({ user: admin(['payments']), token: 'jwt' })
      wrap(
        <RequireRole roles={['ADMIN']} feature="payments">
          <div>Secret</div>
        </RequireRole>,
      )
      expect(screen.getByText('Secret')).toBeInTheDocument()
    })

    it('закрывает страницу, если раздел выключен', () => {
      useAuthStore.setState({ user: admin(['chat']), token: 'jwt' })
      wrap(
        <RequireRole roles={['ADMIN']} feature="payments">
          <div>Secret</div>
        </RequireRole>,
      )
      expect(screen.queryByText('Secret')).not.toBeInTheDocument()
      expect(screen.getByText(/Раздел отключён/)).toBeInTheDocument()
    })

    it('роль проверяется раньше раздела: чужая роль видит «Нет доступа»', () => {
      useAuthStore.setState({ user: { ...admin(['payments']), role: 'TEACHER' }, token: 'jwt' })
      wrap(
        <RequireRole roles={['ADMIN']} feature="payments">
          <div>Secret</div>
        </RequireRole>,
      )
      expect(screen.getByText(/Нет доступа/)).toBeInTheDocument()
    })

    it('владелец платформы проходит в любой раздел', () => {
      useAuthStore.setState({ user: admin([], null), token: 'jwt' })
      wrap(
        <RequireRole roles={['ADMIN']} feature="payments">
          <div>Secret</div>
        </RequireRole>,
      )
      expect(screen.getByText('Secret')).toBeInTheDocument()
    })
  })
})
