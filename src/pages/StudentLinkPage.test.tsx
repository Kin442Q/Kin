import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

import { http } from '../api'
import { useAuthStore } from '../store/authStore'
import StudentLinkPage from './StudentLinkPage'

const TOKEN = 'cmw1abc2d0000x1y2z3k4l5m6.AbCdEfGhIjKlMnOpQrStUv'

function renderPage(token = TOKEN) {
  return render(
    <MemoryRouter initialEntries={[`/s/${token}`]}>
      <AntdApp>
        <Routes>
          <Route path="/s/:token" element={<StudentLinkPage />} />
          <Route path="/student/home" element={<div>КАБИНЕТ УЧЕНИКА</div>} />
          <Route path="/login" element={<div>СТРАНИЦА ВХОДА</div>} />
        </Routes>
      </AntdApp>
    </MemoryRouter>,
  )
}

const loginReply = {
  data: {
    user: {
      id: 'u1',
      fullName: 'Али Каримов',
      email: 'st1abc@students.local',
      role: 'STUDENT',
      kindergartenId: 'k1',
      studentId: 'st1',
      features: ['portal'],
    },
    accessToken: 'access-1',
  },
}

describe('StudentLinkPage (/s/:token)', () => {
  beforeEach(() => {
    vi.mocked(http.post).mockReset()
    vi.mocked(http.get).mockReset()
    useAuthStore.setState({ user: null, token: null })
  })

  it('открыли ссылку: отправляем токен из адреса, сохраняем сессию и уходим в кабинет ученика', async () => {
    vi.mocked(http.post).mockResolvedValue(loginReply as never)
    vi.mocked(http.get).mockResolvedValue({ data: { institution: { id: 'k1', type: 'SCHOOL' } } } as never)
    renderPage()

    expect(await screen.findByText('КАБИНЕТ УЧЕНИКА')).toBeInTheDocument()
    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post).toHaveBeenCalledWith('/v1/auth/student-link', { token: TOKEN })
    expect(http.get).toHaveBeenCalledWith('/v1/auth/me', { headers: { Authorization: 'Bearer access-1' } })

    const s = useAuthStore.getState()
    expect(s.token).toBe('access-1')
    expect(s.user).toMatchObject({ id: 'u1', role: 'STUDENT', studentId: 'st1', kindergartenId: 'k1' })
    expect(s.user?.institution).toMatchObject({ id: 'k1' })
  })

  it('не вышло получить /me — это не мешает войти', async () => {
    vi.mocked(http.post).mockResolvedValue(loginReply as never)
    vi.mocked(http.get).mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText('КАБИНЕТ УЧЕНИКА')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('access-1')
  })

  it('мёртвая ссылка: понятная фраза и кнопка на вход, сессия не создаётся', async () => {
    vi.mocked(http.post).mockRejectedValue({
      response: { status: 401, data: { message: 'Ссылка не работает. Попросите классного руководителя выдать новую.' } },
    })
    renderPage()

    expect(await screen.findByText(/Ссылка не работает\. Попросите классного руководителя выдать новую\./)).toBeInTheDocument()
    expect(screen.queryByText('КАБИНЕТ УЧЕНИКА')).not.toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'На страницу входа' }))
    expect(await screen.findByText('СТРАНИЦА ВХОДА')).toBeInTheDocument()
  })

  it('сервер недоступен — тот же понятный ответ, а не пустой экран', async () => {
    vi.mocked(http.post).mockRejectedValue(new Error('Network Error'))
    renderPage()

    expect(await screen.findByText(/Ссылка не работает\. Попросите классного руководителя выдать новую\./)).toBeInTheDocument()
  })

  it('кабинет отключён школой — показываем это сообщение сервера', async () => {
    vi.mocked(http.post).mockRejectedValue({
      response: { status: 401, data: { message: 'Кабинет ученика отключён для вашей школы' } },
    })
    renderPage()

    expect(await screen.findByText('Кабинет ученика отключён для вашей школы')).toBeInTheDocument()
  })

  it('ответ без токена доступа не считается входом', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { user: loginReply.data.user } } as never)
    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(useAuthStore.getState().token).toBeNull()
    expect(screen.queryByText('КАБИНЕТ УЧЕНИКА')).not.toBeInTheDocument()
  })
})
