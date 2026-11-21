import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api/schoolApi', () => ({
  studentsBulkApi: { remove: vi.fn() },
}))

import { studentsBulkApi } from '../api/schoolApi'
import BulkDeleteStudentsModal from './BulkDeleteStudentsModal'
import type { Child } from '../types'

// antd-окна в jsdom рисуются небыстро
vi.setConfig({ testTimeout: 20_000 })
configure({ asyncUtilTimeout: 8_000 })

const api = vi.mocked(studentsBulkApi)

const kids = (n: number): Child[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    firstName: `Имя${i + 1}`,
    lastName: `Фамилия${i + 1}`,
    birthDate: '2015-01-01',
    gender: 'male',
    groupId: 'g1',
    createdAt: '2026-01-01',
  }))

function renderModal(students: Child[], onDeleted = vi.fn(), onClose = vi.fn()) {
  render(
    <AntdApp>
      <BulkDeleteStudentsModal open students={students} onClose={onClose} onDeleted={onDeleted} />
    </AntdApp>,
  )
  return { onDeleted, onClose }
}

const deleteButton = (n: number) => screen.getByRole('button', { name: new RegExp(`Удалить навсегда: ${n}`) })

describe('BulkDeleteStudentsModal — подтверждение пакетного удаления', () => {
  beforeEach(() => {
    api.remove.mockReset()
  })

  it('показывает число учеников, имена и предупреждение, что удаление необратимо', async () => {
    renderModal(kids(3))
    expect(await screen.findByText('Удалить учеников: 3')).toBeInTheDocument()
    expect(screen.getByText('Удаление необратимо')).toBeInTheDocument()
    expect(screen.getByText(/Восстановить удалённое нельзя/)).toBeInTheDocument()
    expect(screen.getByText(/Фамилия1 Имя1/)).toBeInTheDocument()
    expect(screen.getByText(/Фамилия3 Имя3/)).toBeInTheDocument()
  })

  it('до 5 учеников слово вводить не нужно: можно удалить сразу', async () => {
    api.remove.mockResolvedValue({ deleted: 5, failed: [] })
    const { onDeleted } = renderModal(kids(5))
    await screen.findByText('Удалить учеников: 5')
    expect(screen.queryByLabelText('Слово для подтверждения')).not.toBeInTheDocument()
    expect(deleteButton(5)).toBeEnabled()

    fireEvent.click(deleteButton(5))
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith(['s1', 's2', 's3', 's4', 's5']))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith({ deleted: 5, failed: [] }))
  })

  it('больше 5 учеников: без слова «УДАЛИТЬ» удалить нельзя, запрос не уходит', async () => {
    renderModal(kids(6))
    await screen.findByText('Удалить учеников: 6')
    expect(screen.getByLabelText('Слово для подтверждения')).toBeInTheDocument()
    const btn = deleteButton(6)
    expect(btn).toBeDisabled()

    fireEvent.click(btn)
    expect(api.remove).not.toHaveBeenCalled()

    // неверное слово — тоже нельзя
    fireEvent.change(screen.getByLabelText('Слово для подтверждения'), { target: { value: 'удалю' } })
    expect(deleteButton(6)).toBeDisabled()
    fireEvent.click(deleteButton(6))
    expect(api.remove).not.toHaveBeenCalled()
  })

  it('Enter в поле тоже не обходит проверку слова', async () => {
    renderModal(kids(7))
    await screen.findByText('Удалить учеников: 7')
    fireEvent.keyDown(screen.getByLabelText('Слово для подтверждения'), { key: 'Enter', keyCode: 13 })
    expect(api.remove).not.toHaveBeenCalled()
  })

  it('больше 5 учеников: после слова «УДАЛИТЬ» (в любом регистре) кнопка включается и удаляет всех', async () => {
    api.remove.mockResolvedValue({ deleted: 6, failed: [] })
    const { onDeleted } = renderModal(kids(6))
    await screen.findByText('Удалить учеников: 6')

    fireEvent.change(screen.getByLabelText('Слово для подтверждения'), { target: { value: ' удалить ' } })
    await waitFor(() => expect(deleteButton(6)).toBeEnabled())
    fireEvent.click(deleteButton(6))

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith(['s1', 's2', 's3', 's4', 's5', 's6']))
    expect(await screen.findByText('Удалено: 6')).toBeInTheDocument()
    expect(onDeleted).toHaveBeenCalledTimes(1)
  })

  it('длинный список: показывает первые имена и «и ещё N»', async () => {
    renderModal(kids(20))
    expect(await screen.findByText('и ещё 12')).toBeInTheDocument()
    expect(screen.getByText(/Фамилия8 Имя8/)).toBeInTheDocument()
    expect(screen.queryByText(/Фамилия9 Имя9/)).not.toBeInTheDocument()
  })

  it('часть не удалилась: итог «Удалено: N» и список с именами и причинами', async () => {
    api.remove.mockResolvedValue({
      deleted: 2,
      failed: [{ id: 's3', reason: 'Ученик не найден' }],
    })
    renderModal(kids(3))
    await screen.findByText('Удалить учеников: 3')
    fireEvent.click(deleteButton(3))

    expect(await screen.findByText('Удалено: 2')).toBeInTheDocument()
    expect(screen.getByText('Не удалось удалить: 1')).toBeInTheDocument()
    expect(screen.getByText('Фамилия3 Имя3')).toBeInTheDocument()
    expect(screen.getByText('Ученик не найден')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
  })

  it('ошибка запроса: показывает сообщение сервера, окно остаётся для повтора, страница не обновляется', async () => {
    api.remove.mockRejectedValue({ response: { data: { message: 'Недостаточно прав' } } })
    const { onDeleted } = renderModal(kids(2))
    await screen.findByText('Удалить учеников: 2')
    fireEvent.click(deleteButton(2))

    expect(await screen.findByText('Недостаточно прав')).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(deleteButton(2)).toBeEnabled()
  })

  it('«Отмена» закрывает окно и ничего не удаляет', async () => {
    const { onClose } = renderModal(kids(2))
    await screen.findByText('Удалить учеников: 2')
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onClose).toHaveBeenCalled()
    expect(api.remove).not.toHaveBeenCalled()
  })
})
