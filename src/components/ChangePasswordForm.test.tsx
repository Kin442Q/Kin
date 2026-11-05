import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api/accessApi', () => ({ accessApi: { changePassword: vi.fn(), reset: vi.fn() } }))

import { accessApi } from '../api/accessApi'
import { useAuthStore } from '../store/authStore'
import ChangePasswordForm from './ChangePasswordForm'
import MustChangePasswordGate from './MustChangePasswordGate'

vi.setConfig({ testTimeout: 20_000 })
configure({ asyncUtilTimeout: 8_000 })

const api = vi.mocked(accessApi)

const user = (patch: Record<string, unknown> = {}) => ({
  id: 'u1',
  fullName: 'Учитель Тест',
  email: 't@school.tj',
  role: 'TEACHER' as const,
  kindergartenId: 'k1',
  ...patch,
})

function fill(current: string, next: string, repeat: string) {
  fireEvent.change(document.querySelector('input[autocomplete="current-password"]')!, { target: { value: current } })
  const fresh = document.querySelectorAll('input[autocomplete="new-password"]')
  fireEvent.change(fresh[0], { target: { value: next } })
  fireEvent.change(fresh[1], { target: { value: repeat } })
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    api.changePassword.mockReset()
    useAuthStore.setState({ user: user({ mustChangePassword: true }) as never, token: 'old-access' })
  })

  const renderForm = (onDone?: () => void) =>
    render(
      <AntdApp>
        <ChangePasswordForm onDone={onDone} />
      </AntdApp>,
    )

  it('короткий новый пароль, несовпадение и «такой же, как текущий» — ошибки, запрос не уходит', async () => {
    renderForm()

    fill('old-password-1', '1234567', '1234567')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))
    expect(await screen.findByText('Минимум 8 символов')).toBeInTheDocument()

    fill('old-password-1', 'new-password-2', 'new-password-3')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))
    expect(await screen.findByText('Пароли не совпадают')).toBeInTheDocument()

    fill('old-password-1', 'old-password-1', 'old-password-1')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))
    expect(await screen.findByText('Новый пароль должен отличаться от текущего')).toBeInTheDocument()

    expect(api.changePassword).not.toHaveBeenCalled()
  })

  it('успех: в запрос уходят текущий и новый пароль, токен обновляется, флаг «сменить пароль» снят', async () => {
    api.changePassword.mockResolvedValue({ accessToken: 'new-access' })
    const onDone = vi.fn()
    renderForm(onDone)

    fill('old-password-1', 'new-password-2', 'new-password-2')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'old-password-1', newPassword: 'new-password-2' })
    expect(useAuthStore.getState().token).toBe('new-access')
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(false)
  })

  it('сервер отказал (неверный текущий пароль): сообщение показано, токен и флаг не тронуты', async () => {
    api.changePassword.mockRejectedValue({ response: { data: { message: 'Текущий пароль неверный' } } })
    const onDone = vi.fn()
    renderForm(onDone)

    fill('wrong-password', 'new-password-2', 'new-password-2')
    fireEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))

    expect(await screen.findByText('Текущий пароль неверный')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    expect(useAuthStore.getState().token).toBe('old-access')
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(true)
  })
})

describe('MustChangePasswordGate', () => {
  const renderGate = () =>
    render(
      <MemoryRouter>
        <AntdApp>
          <MustChangePasswordGate />
        </AntdApp>
      </MemoryRouter>,
    )

  beforeEach(() => {
    api.changePassword.mockReset()
  })

  it('вошли по временному паролю: окно «Придумайте свой пароль» перекрывает работу и не закрывается крестиком', async () => {
    useAuthStore.setState({ user: user({ mustChangePassword: true }) as never, token: 't' })
    renderGate()

    expect(await screen.findByText('Придумайте свой пароль')).toBeInTheDocument()
    expect(screen.getByText('Вы вошли по временному паролю')).toBeInTheDocument()
    expect(document.querySelector('.ant-modal-close')).toBeNull()
    expect(screen.getByRole('button', { name: 'Сохранить и продолжить' })).toBeInTheDocument()
  })

  it('обычный вход: окна нет', () => {
    useAuthStore.setState({ user: user() as never, token: 't' })
    renderGate()

    expect(screen.queryByText('Придумайте свой пароль')).not.toBeInTheDocument()
  })

  it('после смены пароля окно исчезает', async () => {
    useAuthStore.setState({ user: user({ mustChangePassword: true }) as never, token: 't' })
    api.changePassword.mockResolvedValue({ accessToken: 'new' })
    renderGate()

    await screen.findByText('Придумайте свой пароль')
    fill('temp-password-1', 'brand-new-pass-1', 'brand-new-pass-1')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и продолжить' }))

    await waitFor(() => expect(useAuthStore.getState().user?.mustChangePassword).toBe(false))
  })
})
