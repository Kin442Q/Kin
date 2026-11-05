import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api/schoolApi', () => ({
  studentAccountApi: { classLinks: vi.fn(), issueClassLinks: vi.fn() },
}))
vi.mock('../lib/studentCards', () => ({ printStudentCards: vi.fn() }))

import { studentAccountApi } from '../api/schoolApi'
import { printStudentCards } from '../lib/studentCards'
import ClassLinksModal from './ClassLinksModal'

// antd-окна в jsdom рисуются небыстро
vi.setConfig({ testTimeout: 20_000 })
configure({ asyncUtilTimeout: 8_000 })

const api = vi.mocked(studentAccountApi)
const group = { id: 'g1', name: '5А' }

const row = (n: number, patch: Record<string, unknown> = {}) => ({
  studentId: `st${n}`,
  firstName: `Имя${n}`,
  lastName: `Фамилия${n}`,
  lastLoginAt: null,
  link: `https://tahlilgar.cyou/s/u${n}.AbCdEfGhIjKlMnOpQrStUv`,
  ...patch,
})

function renderModal() {
  return render(
    <AntdApp>
      <ClassLinksModal group={group} onClose={() => {}} />
    </AntdApp>,
  )
}

describe('ClassLinksModal — ссылки класса', () => {
  beforeEach(() => {
    api.classLinks.mockReset()
    api.issueClassLinks.mockReset()
    vi.mocked(printStudentCards).mockReset()
  })

  it('список класса: у кого ссылка выдана, кто когда заходил; запрос по id класса', async () => {
    api.classLinks.mockResolvedValue({
      group,
      students: [row(1, { lastLoginAt: '2026-11-04T09:30:00.000Z' }), row(2, { link: null })],
    })
    renderModal()

    expect(await screen.findByText('Фамилия1 Имя1')).toBeInTheDocument()
    expect(api.classLinks).toHaveBeenCalledWith('g1')
    expect(screen.getByText('выдана')).toBeInTheDocument()
    expect(screen.getByText('не выдана')).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(screen.getByText('ещё не заходил')).toBeInTheDocument()
  })

  it('«Выдать всем (N)» считает недостающие, выдаёт и обновляет таблицу', async () => {
    api.classLinks.mockResolvedValue({ group, students: [row(1), row(2, { link: null }), row(3, { link: null })] })
    api.issueClassLinks.mockResolvedValue({ group, students: [row(1), row(2), row(3)] })
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: /Выдать всем \(2\)/ }))

    await waitFor(() => expect(api.issueClassLinks).toHaveBeenCalledWith('g1'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Выдать всем/ })).toBeDisabled()) // все получили
    expect(screen.queryByText('не выдана')).not.toBeInTheDocument()
  })

  it('«Печать карточек» печатает только тех, у кого есть ссылка, с именем и ссылкой', async () => {
    api.classLinks.mockResolvedValue({ group, students: [row(1), row(2, { link: null }), row(3)] })
    vi.mocked(printStudentCards).mockResolvedValue(true)
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: /Печать карточек/ }))

    await waitFor(() => expect(printStudentCards).toHaveBeenCalledTimes(1))
    expect(printStudentCards).toHaveBeenCalledWith('5А', [
      { name: 'Фамилия1 Имя1', link: row(1).link },
      { name: 'Фамилия3 Имя3', link: row(3).link },
    ])
  })

  it('ни у кого нет ссылок: печать недоступна, «Выдать всем» доступно', async () => {
    api.classLinks.mockResolvedValue({ group, students: [row(1, { link: null })] })
    renderModal()

    expect(await screen.findByRole('button', { name: /Печать карточек/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Выдать всем/ })).toBeEnabled()
  })

  it('браузер заблокировал окно печати — подсказка, а не тишина', async () => {
    api.classLinks.mockResolvedValue({ group, students: [row(1)] })
    vi.mocked(printStudentCards).mockResolvedValue(false)
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: /Печать карточек/ }))
    expect(await screen.findByText(/Разрешите всплывающие окна/)).toBeInTheDocument()
  })
})
