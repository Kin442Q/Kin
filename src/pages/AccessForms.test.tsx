import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, configure } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import { http } from '../api'
import StaffPage from './StaffPage'
import SchoolsPage from './SchoolsPage'

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

function renderPage(page: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AntdApp>{page}</AntdApp>
    </MemoryRouter>,
  )
}

describe('формы выдачи доступа — пароль админ не вводит и не видит', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset().mockResolvedValue({ data: [] } as never)
  })

  it('сотрудники: при «Может входить в систему» нет поля пароля и нет «Нет почты»', async () => {
    renderPage(<StaffPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Новый сотрудник/ }))
    await screen.findByText('Учётная запись')
    // включаем вход в систему
    fireEvent.click(screen.getAllByRole('switch')[0])

    expect(await screen.findByText(/на этот адрес придёт письмо со ссылкой/)).toBeInTheDocument()
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0)
    expect(screen.queryByText('Нет почты')).not.toBeInTheDocument()
    expect(screen.queryByText(/Минимум 6 символов/)).not.toBeInTheDocument()
  })

  it('школы: у директора только ФИО и email — ни поля пароля, ни ручного ввода', async () => {
    renderPage(<SchoolsPage />)

    // в jsdom экран «узкий» (на кнопке «Новая»), а имя кнопки начинается с названия иконки
    fireEvent.click(await screen.findByRole('button', { name: /Новая/ }))
    await screen.findByText('Первый администратор', { exact: false })

    expect(screen.getByLabelText('ФИО владельца')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0)
    expect(screen.queryByText('Задать пароль вручную')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/Пароль вы не задаёте, не видите и не передаёте/)).toBeInTheDocument()
  })
})
