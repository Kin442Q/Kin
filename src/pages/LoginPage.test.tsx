import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

import { http } from '../api'
import LoginPage, { buildLoginPayload } from './LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter>
      <AntdApp>
        <LoginPage />
      </AntdApp>
    </MemoryRouter>,
  )
}

describe('buildLoginPayload', () => {
  it('есть «@» — это email: обрезаем пробелы и приводим к нижнему регистру', () => {
    expect(buildLoginPayload('  Admin@Kindergarten.TJ ', 'pw')).toEqual({
      email: 'admin@kindergarten.tj',
      password: 'pw',
    })
  })

  it('буквы без «@» — это логин ученика: обрезаем пробелы, приводим к нижнему регистру', () => {
    expect(buildLoginPayload('  ST4K9X2M ', 'abcd2345')).toEqual({ login: 'st4k9x2m', password: 'abcd2345' })
  })

  it('номер телефона с пробелами, скобками и дефисами остаётся телефоном', () => {
    expect(buildLoginPayload('(90) 123-45-67', 'pw')).toEqual({ phone: '(90) 123-45-67', password: 'pw' })
  })

  it('нет «@» — это телефон: отправляем как введён, без изменения регистра', () => {
    expect(buildLoginPayload(' +992 90 123 45 67 ', 'pw')).toEqual({
      phone: '+992 90 123 45 67',
      password: 'pw',
    })
  })
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(http.post).mockReset()
    // Ответ без user/accessToken: страница покажет ошибку и не полезет в стор.
    vi.mocked(http.post).mockResolvedValue({ data: {} } as never)
  })

  it('одна форма для всех ролей: нет вкладок «Админ / Учитель / Родитель / Ученик»', () => {
    const { container } = renderLogin()
    // один проход по кнопкам (queryByRole по дереву antd в jsdom медленный)
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent ?? '')
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect(label).not.toMatch(/Админ|Учитель|Воспитатель|Родитель|Ученик/)
    }
  })

  it('одно поле «Email, телефон или логин» и пароль', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('email, телефон или логин')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('email в поле → в запрос уходит email', async () => {
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('email, телефон или логин'), {
      target: { value: 'Teacher@School.tj' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: /Войти/ }))

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/v1/auth/login', {
        email: 'teacher@school.tj',
        password: 'secret1',
      }),
    )
  })

  it('телефон в поле → в запрос уходит phone', async () => {
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('email, телефон или логин'), {
      target: { value: '+992901112233' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: /Войти/ }))

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/v1/auth/login', {
        phone: '+992901112233',
        password: 'secret1',
      }),
    )
  })

  it('пустая форма не отправляется', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /Войти/ }))
    await waitFor(() =>
      expect(screen.getByText(/Введите email, телефон или логин/)).toBeInTheDocument(),
    )
    expect(http.post).not.toHaveBeenCalled()
  })

  it('ссылка «Запросить демо» удалена', () => {
    renderLogin()
    expect(screen.queryByText(/Запросить демо/)).not.toBeInTheDocument()
  })

  it('бренд «Моя школа» присутствует', () => {
    renderLogin()
    expect(screen.getAllByAltText('Моя школа').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Maktab/)).not.toBeInTheDocument()
  })

  it('кнопка смены темы есть и подписана', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /тема/i })).toBeInTheDocument()
  })
})
