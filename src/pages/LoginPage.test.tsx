import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

import LoginPage from './LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter>
      <AntdApp>
        <LoginPage />
      </AntdApp>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('показывает три вкладки входа: админ, воспитатель, родитель', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /Админ/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Воспитатель/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Родитель/ })).toBeInTheDocument()
  })

  it('по умолчанию (админ) — поле Email', () => {
    renderLogin()
    expect(
      screen.getByPlaceholderText('admin@kindergarten.tj'),
    ).toBeInTheDocument()
  })

  it('воспитатель → поле телефона', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /Воспитатель/ }))
    expect(
      screen.getByPlaceholderText('+992 90 123 45 67'),
    ).toBeInTheDocument()
  })

  it('родитель → поле Email (а не телефон)', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /Родитель/ }))
    expect(
      screen.getByPlaceholderText('parent@kindergarten.tj'),
    ).toBeInTheDocument()
  })

  it('ссылка «Запросить демо» удалена', () => {
    renderLogin()
    expect(screen.queryByText(/Запросить демо/)).not.toBeInTheDocument()
  })

  it('бренд Nihol присутствует', () => {
    renderLogin()
    expect(screen.getAllByText(/Nihol/).length).toBeGreaterThan(0)
  })
})
