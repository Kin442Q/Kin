import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

import { http } from '../api'
import SetPasswordPage from './SetPasswordPage'

function renderPage(url = '/set-password?token=tok123') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AntdApp>
        <Routes>
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/login" element={<div>СТРАНИЦА ВХОДА</div>} />
        </Routes>
      </AntdApp>
    </MemoryRouter>,
  )
}

const valid = (purpose: 'INVITE' | 'RESET' = 'INVITE') =>
  ({ data: { valid: true, purpose, email: 'di***@school.tj', expiresAt: '2030-01-01T00:00:00Z' } }) as never

describe('SetPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(http.post).mockReset()
  })

  it('без токена в адресе: объяснение и кнопка на вход, запрос не делается', () => {
    renderPage('/set-password')

    expect(screen.getByText(/нет ссылки для установки пароля/i)).toBeInTheDocument()
    expect(screen.getByText('На страницу входа')).toBeInTheDocument()
    expect(http.get).not.toHaveBeenCalled()
  })

  it('приглашение: проверяет токен и показывает форму с замаскированным аккаунтом', async () => {
    vi.mocked(http.get).mockResolvedValue(valid('INVITE'))
    renderPage()

    expect(await screen.findByText('Добро пожаловать!')).toBeInTheDocument()
    expect(screen.getByText('di***@school.tj')).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/v1/auth/password-token/tok123')
    expect(screen.getByPlaceholderText('Минимум 8 символов')).toBeInTheDocument()
  })

  it('сброс пароля: другой заголовок', async () => {
    vi.mocked(http.get).mockResolvedValue(valid('RESET'))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Новый пароль' })).toBeInTheDocument()
  })

  it.each([
    ['EXPIRED', /Срок действия ссылки истёк/],
    ['USED', /уже использована/],
    ['INVALID', /недействительна/],
  ] as const)('мёртвая ссылка (%s): понятная причина и форма не показывается', async (reason, text) => {
    vi.mocked(http.get).mockResolvedValue({ data: { valid: false, reason } } as never)
    renderPage()

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ссылка не работает' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Минимум 8 символов')).not.toBeInTheDocument()
  })

  it('ошибка сети при проверке — то же, что недействительная ссылка', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText(/недействительна/)).toBeInTheDocument()
  })

  async function fillAndSubmit(password: string, repeat: string) {
    vi.mocked(http.get).mockResolvedValue(valid())
    renderPage()
    await screen.findByPlaceholderText('Минимум 8 символов')
    fireEvent.change(screen.getByPlaceholderText('Минимум 8 символов'), { target: { value: password } })
    fireEvent.change(screen.getByPlaceholderText('Ещё раз'), { target: { value: repeat } })
    fireEvent.click(screen.getByRole('button', { name: /Сохранить пароль/ }))
  }

  it('пароль короче 8 символов не отправляется', async () => {
    await fillAndSubmit('1234567', '1234567')

    expect(await screen.findByText('Минимум 8 символов')).toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('разные пароли не отправляются', async () => {
    await fillAndSubmit('Хороший-пароль-1', 'Хороший-пароль-2')

    expect(await screen.findByText('Пароли не совпадают')).toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('успех: в запрос уходят токен и пароль, потом «Пароль сохранён» и переход ко входу', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { ok: true } } as never)
    await fillAndSubmit('Хороший-пароль-1', 'Хороший-пароль-1')

    expect(await screen.findByRole('heading', { name: 'Пароль сохранён' })).toBeInTheDocument()
    expect(http.post).toHaveBeenCalledWith('/v1/auth/set-password', { token: 'tok123', password: 'Хороший-пароль-1' })

    fireEvent.click(screen.getByText('Войти'))
    expect(await screen.findByText('СТРАНИЦА ВХОДА')).toBeInTheDocument()
  })

  it('отказ сервера: остаёмся на форме, «сохранён» не показываем', async () => {
    vi.mocked(http.post).mockRejectedValue({ response: { data: { message: 'Ссылка недействительна или устарела. Запросите новую.' } } })
    await fillAndSubmit('Хороший-пароль-1', 'Хороший-пароль-1')

    await waitFor(() => expect(http.post).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Пароль сохранён' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Минимум 8 символов')).toBeInTheDocument()
  })
})
