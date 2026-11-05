import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api/schoolApi', () => ({
  studentAccountApi: { get: vi.fn(), issue: vi.fn(), regenerate: vi.fn(), remove: vi.fn() },
}))
vi.mock('../lib/studentCards', () => ({ qrDataUrl: vi.fn().mockResolvedValue('data:image/svg+xml;utf8,%3Csvg%2F%3E') }))

import { studentAccountApi } from '../api/schoolApi'
import StudentAccountModal from './StudentAccountModal'

const student = { id: 'st1', firstName: 'Али', lastName: 'Каримов' }
const LINK = 'https://tahlilgar.cyou/s/u1.AbCdEfGhIjKlMnOpQrStUv'
const account = (patch: Record<string, unknown> = {}) => ({ id: 'u1', isActive: true, lastLoginAt: null, link: LINK, ...patch })

// antd-окна и подтверждения в jsdom рисуются небыстро
vi.setConfig({ testTimeout: 20_000 })
configure({ asyncUtilTimeout: 8_000 })

const api = vi.mocked(studentAccountApi)

function renderModal() {
  return render(
    <AntdApp>
      <StudentAccountModal student={student} onClose={() => {}} />
    </AntdApp>,
  )
}

describe('StudentAccountModal — личная ссылка ученика', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
  })

  it('доступа нет: объяснение и «Выдать ссылку»; полей логина и пароля нет', async () => {
    api.get.mockResolvedValue(null)
    renderModal()

    expect(await screen.findByRole('button', { name: 'Выдать ссылку' })).toBeInTheDocument()
    expect(screen.getByText(/логин и пароль не нужны/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/придумается автоматически|сгенерируется автоматически/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Сбросить пароль/)).not.toBeInTheDocument()
  })

  it('«Выдать ссылку»: запрос уходит, появляются ссылка, «Скопировать», QR и «Ещё не заходил»', async () => {
    api.get.mockResolvedValue(null)
    api.issue.mockResolvedValue(account() as never)
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Выдать ссылку' }))

    expect(await screen.findByDisplayValue(LINK)).toBeInTheDocument()
    expect(api.issue).toHaveBeenCalledWith('st1')
    expect(screen.getByRole('button', { name: /Скопировать/ })).toBeInTheDocument()
    expect(await screen.findByAltText('QR-код ссылки')).toBeInTheDocument()
    expect(screen.getByText('Ещё не заходил')).toBeInTheDocument()
    expect(screen.getByText('Наведите камеру телефона на код')).toBeInTheDocument()
  })

  it('ссылка есть: показываем время последнего входа', async () => {
    api.get.mockResolvedValue(account({ lastLoginAt: '2026-11-04T09:30:00.000Z' }) as never)
    renderModal()

    expect(await screen.findByDisplayValue(LINK)).toBeInTheDocument()
    expect(screen.getByText(/^Заходил: \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(screen.queryByText('Ещё не заходил')).not.toBeInTheDocument()
  })

  it('«Скопировать» кладёт ссылку в буфер обмена', async () => {
    api.get.mockResolvedValue(account() as never)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: /Скопировать/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK))
  })

  it('«Перевыпустить» спрашивает подтверждение; после него показана новая ссылка', async () => {
    const NEW_LINK = 'https://tahlilgar.cyou/s/u1.ZZZZZZZZZZZZZZZZZZZZZZ'
    api.get.mockResolvedValue(account() as never)
    api.regenerate.mockResolvedValue(account({ link: NEW_LINK }) as never)
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Перевыпустить' }))
    expect(api.regenerate).not.toHaveBeenCalled() // сначала подтверждение
    expect(await screen.findByText(/Старая ссылка сразу перестанет работать/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Перевыпустить' }).pop()!)
    expect(await screen.findByDisplayValue(NEW_LINK)).toBeInTheDocument()
    expect(api.regenerate).toHaveBeenCalledWith('st1')
    expect(screen.queryByDisplayValue(LINK)).not.toBeInTheDocument()
  })

  it('«Отключить доступ» после подтверждения убирает ссылку и возвращает «Выдать ссылку»', async () => {
    api.get.mockResolvedValue(account() as never)
    api.remove.mockResolvedValue(undefined as never)
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Отключить доступ' }))
    expect(api.remove).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Отключить' }))

    expect(await screen.findByRole('button', { name: 'Выдать ссылку' })).toBeInTheDocument()
    expect(api.remove).toHaveBeenCalledWith('st1')
    expect(screen.queryByDisplayValue(LINK)).not.toBeInTheDocument()
  })

  it('аккаунт есть, а ссылки нет (старый ученик с логином и паролем): можно выдать ссылку', async () => {
    api.get.mockResolvedValue(account({ link: null }) as never)
    renderModal()

    expect(await screen.findByRole('button', { name: 'Выдать ссылку' })).toBeInTheDocument()
  })
})
