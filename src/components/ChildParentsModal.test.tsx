import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../api/accessApi', async (orig) => ({
  ...(await orig<typeof import('../api/accessApi')>()),
  accessApi: { sendLink: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn() },
}))

import { http } from '../api'
import { accessApi } from '../api/accessApi'
import ChildParentsModal from './ChildParentsModal'

vi.setConfig({ testTimeout: 25_000 })
configure({ asyncUtilTimeout: 10_000 })

const parent = { id: 'p1', fullName: 'Мама Тест', email: 'mama@mail.tj', phone: '+992900000001', isActive: true }

function renderModal() {
  return render(
    <AntdApp>
      <ChildParentsModal open onClose={() => {}} childId="st1" childName="Али Каримов" />
    </AntdApp>,
  )
}

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: /Добавить родителя/ }))
  await screen.findByText('Новый родительский аккаунт')
}

const typeInto = (placeholder: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })

describe('ChildParentsModal — родитель получает ссылку на почту, пароля от админа нет', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset().mockResolvedValue({ data: [] } as never)
    vi.mocked(http.post).mockReset()
    vi.mocked(accessApi.sendLink).mockReset()
  })

  it('в форме нет поля пароля и нет «Нет почты»: ФИО, email и необязательный телефон', async () => {
    renderModal()
    await openForm()

    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0)
    expect(screen.queryByText(/Пароль:|Минимум 6/)).not.toBeInTheDocument()
    expect(screen.queryByText('Нет почты')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/сам придумает пароль/)).toBeInTheDocument()
  })

  it('в запрос уходят ФИО и email в нижнем регистре, пароля нет; показано «Письмо ушло»', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { id: 'p2', access: { sent: true, email: 'mama@mail.tj' } } } as never)
    renderModal()
    await openForm()

    typeInto('Например, Иванова Мария Петровна', 'Мама Тест')
    typeInto('parent@example.com', 'Mama@Mail.TJ')
    fireEvent.click(screen.getByRole('button', { name: 'Создать и привязать' }))

    expect(await screen.findByText('Письмо ушло на mama@mail.tj')).toBeInTheDocument()
    expect(http.post).toHaveBeenCalledTimes(1)
    const [url, body] = vi.mocked(http.post).mock.calls[0] as [string, Record<string, unknown>]
    expect(url).toBe('/v1/students/st1/parents')
    expect(body).toMatchObject({ fullName: 'Мама Тест', email: 'mama@mail.tj' })
    expect(body).not.toHaveProperty('password')
    expect(body).not.toHaveProperty('noEmail')
    expect(body.phone).toBeUndefined() // «+992 » без цифр — пустой телефон
  })

  it('письмо не ушло: аккаунт создан, видна причина и можно отправить ещё раз', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: { id: 'p2', access: { sent: false, email: 'mama@mail.tj', reason: 'NOT_CONFIGURED' } },
    } as never)
    vi.mocked(accessApi.sendLink).mockResolvedValue({ sent: true, email: 'mama@mail.tj' })
    renderModal()
    await openForm()

    typeInto('Например, Иванова Мария Петровна', 'Мама Тест')
    typeInto('parent@example.com', 'mama@mail.tj')
    fireEvent.click(screen.getByRole('button', { name: 'Создать и привязать' }))

    expect(await screen.findByText('Письмо на mama@mail.tj не ушло')).toBeInTheDocument()
    expect(screen.queryByText(/Временный пароль/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Отправить приглашение ещё раз/ }))
    await waitFor(() => expect(accessApi.sendLink).toHaveBeenCalledWith('p2'))
    expect(await screen.findByText('Письмо ушло на mama@mail.tj')).toBeInTheDocument()
  })

  it('без email: просит указать, запрос не уходит', async () => {
    renderModal()
    await openForm()

    typeInto('Например, Иванова Мария Петровна', 'Мама Тест')
    fireEvent.click(screen.getByRole('button', { name: 'Создать и привязать' }))

    expect(await screen.findByText('Укажите email: на него придёт приглашение')).toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('«Отправить ссылку для пароля» у родителя: после подтверждения письмо уходит, админ видит итог', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [parent] } as never)
    vi.mocked(accessApi.sendLink).mockResolvedValue({ sent: true, email: 'mama@mail.tj' })
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Отправить ссылку для пароля' }))
    expect(accessApi.sendLink).not.toHaveBeenCalled() // сначала подтверждение
    fireEvent.click(await screen.findByRole('button', { name: 'Отправить' }))

    await waitFor(() => expect(accessApi.sendLink).toHaveBeenCalledWith('p1'))
    expect(await screen.findByText('Письмо ушло на mama@mail.tj')).toBeInTheDocument()
  })

  it('служебный адрес (.local) в списке родителей не показывается как почта, ссылку слать нельзя', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: [{ ...parent, email: 'parent-1-abc@no-email.local' }],
    } as never)
    renderModal()

    expect(await screen.findByText('Мама Тест')).toBeInTheDocument()
    expect(screen.queryByText(/no-email\.local/)).not.toBeInTheDocument()
    expect(screen.getByText('+992900000001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить ссылку для пароля' })).toBeDisabled()
  })
})
