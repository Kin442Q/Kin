import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api/schoolApi', () => ({
  studentAccountApi: { classLinks: vi.fn(), issueClassLinks: vi.fn(), issueClassPasswords: vi.fn() },
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
  login: `st${n}login`,
  passwordIssued: false,
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
    api.issueClassPasswords.mockReset()
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

  describe('логины и пароли класса', () => {
    it('«Выдать логины и пароли»: уходит запрос только для тех, у кого их нет; пароли видны с предупреждением и идут на печать', async () => {
      api.classLinks
        .mockResolvedValueOnce({ group, students: [row(1, { passwordIssued: true }), row(2), row(3)] })
        .mockResolvedValueOnce({ group, students: [row(1, { passwordIssued: true }), row(2, { passwordIssued: true }), row(3, { passwordIssued: true })] })
      api.issueClassPasswords.mockResolvedValue({
        group,
        students: [
          { studentId: 'st1', firstName: 'Имя1', lastName: 'Фамилия1', login: 'st1login', passwordIssued: true, password: null },
          { studentId: 'st2', firstName: 'Имя2', lastName: 'Фамилия2', login: 'st2login', passwordIssued: true, password: 'aaaa2222' },
          { studentId: 'st3', firstName: 'Имя3', lastName: 'Фамилия3', login: 'st3login', passwordIssued: true, password: 'bbbb3333' },
        ],
      })
      renderModal()

      fireEvent.click(await screen.findByRole('button', { name: /Выдать логины и пароли \(2\)/ }))

      await waitFor(() => expect(api.issueClassPasswords).toHaveBeenCalledWith('g1', true))
      expect(await screen.findByText('aaaa2222')).toBeInTheDocument()
      expect(screen.getByText('bbbb3333')).toBeInTheDocument()
      expect(screen.getByText('Пароли видны только сейчас')).toBeInTheDocument()
      // у того, кому пароль выдан раньше, показать его нечем
      expect(screen.getAllByText('пароль выдан').length).toBeGreaterThan(0)

      fireEvent.click(screen.getByRole('button', { name: /Печать карточек/ }))
      await waitFor(() => expect(printStudentCards).toHaveBeenCalled())
      const rows = vi.mocked(printStudentCards).mock.calls[0][1]
      expect(rows.find((r) => r.name === 'Фамилия2 Имя2')).toMatchObject({ login: 'st2login', password: 'aaaa2222' })
      expect(rows.find((r) => r.name === 'Фамилия1 Имя1')?.password).toBeUndefined()
    })

    it('«Пароли заново всем» спрашивает подтверждение и шлёт onlyMissing = false', async () => {
      api.classLinks.mockResolvedValue({ group, students: [row(1, { passwordIssued: true })] })
      api.issueClassPasswords.mockResolvedValue({
        group,
        students: [{ studentId: 'st1', firstName: 'Имя1', lastName: 'Фамилия1', login: 'st1login', passwordIssued: true, password: 'cccc4444' }],
      })
      renderModal()

      fireEvent.click(await screen.findByRole('button', { name: 'Пароли заново всем' }))
      expect(api.issueClassPasswords).not.toHaveBeenCalled()
      fireEvent.click(await screen.findByRole('button', { name: 'Выдать заново' }))

      await waitFor(() => expect(api.issueClassPasswords).toHaveBeenCalledWith('g1', false))
      expect(await screen.findByText('cccc4444')).toBeInTheDocument()
    })

    it('у всех уже есть пароли: «Выдать логины и пароли» выключена', async () => {
      api.classLinks.mockResolvedValue({ group, students: [row(1, { passwordIssued: true })] })
      renderModal()
      expect(await screen.findByRole('button', { name: 'Выдать логины и пароли' })).toBeDisabled()
    })
  })
})
