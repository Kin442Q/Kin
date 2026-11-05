import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api/accessApi', () => ({ accessApi: { changeEmail: vi.fn(), changePassword: vi.fn(), reset: vi.fn() } }))

import { accessApi } from '../api/accessApi'
import { useAuthStore } from '../store/authStore'
import ChangeEmailForm from './ChangeEmailForm'

vi.setConfig({ testTimeout: 20_000 })
configure({ asyncUtilTimeout: 8_000 })

const api = vi.mocked(accessApi)

function renderForm() {
  return render(
    <AntdApp>
      <ChangeEmailForm />
    </AntdApp>,
  )
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('new@example.com'), { target: { value: email } })
  fireEvent.change(document.querySelector('input[autocomplete="current-password"]')!, { target: { value: password } })
}

describe('ChangeEmailForm — смена своего логина', () => {
  beforeEach(() => {
    api.changeEmail.mockReset()
    useAuthStore.setState({
      user: { id: 'u1', fullName: 'Учитель', email: 'old@school.tj', role: 'TEACHER', kindergartenId: 'k1' } as never,
      token: 'old-access',
    })
  })

  it('показывает, под каким email человек входит сейчас', () => {
    renderForm()
    expect(screen.getByText('old@school.tj')).toBeInTheDocument()
  })

  it('некорректный адрес и пустой пароль: ошибки, запрос не уходит', async () => {
    renderForm()

    fill('не-почта', '')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить email' }))

    expect(await screen.findByText('Некорректный email')).toBeInTheDocument()
    expect(await screen.findByText('Введите текущий пароль')).toBeInTheDocument()
    expect(api.changeEmail).not.toHaveBeenCalled()
  })

  it('успех: уходят новый email и текущий пароль, в сессии новый email и новый токен', async () => {
    api.changeEmail.mockResolvedValue({ accessToken: 'new-access', user: { email: 'new@school.tj' } })
    renderForm()

    fill('New@School.tj', 'old-password-1')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить email' }))

    await waitFor(() => expect(useAuthStore.getState().user?.email).toBe('new@school.tj'))
    expect(api.changeEmail).toHaveBeenCalledWith({ currentPassword: 'old-password-1', newEmail: 'New@School.tj' })
    expect(useAuthStore.getState().token).toBe('new-access')
  })

  it('сервер отказал (email занят): сообщение показано, сессия не тронута', async () => {
    api.changeEmail.mockRejectedValue({ response: { data: { message: 'Этот email уже занят' } } })
    renderForm()

    fill('taken@school.tj', 'old-password-1')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить email' }))

    expect(await screen.findByText('Этот email уже занят')).toBeInTheDocument()
    expect(useAuthStore.getState().user?.email).toBe('old@school.tj')
    expect(useAuthStore.getState().token).toBe('old-access')
  })
})
