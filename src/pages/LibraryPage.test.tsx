import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { App as AntdApp } from 'antd'

const httpGet = vi.fn()
vi.mock('../api', () => ({ http: { get: (...a: unknown[]) => httpGet(...a) } }))

const list = vi.fn()
const create = vi.fn()
const update = vi.fn()
vi.mock('../api/learningApi', async (orig) => {
  const actual = await orig<typeof import('../api/learningApi')>()
  return {
    ...actual,
    libraryApi: {
      ...actual.libraryApi,
      list: (...a: unknown[]) => list(...a),
      create: (...a: unknown[]) => create(...a),
      update: (...a: unknown[]) => update(...a),
    },
  }
})

import LibraryPage from './LibraryPage'
import { useAuthStore } from '../store/authStore'
import type { LibraryItem } from '../api/learningApi'
import type { User } from '../types'

const teacher = { id: 't1', fullName: 'Мария', email: 't@s.tj', role: 'TEACHER', kindergartenId: 'k1' } as unknown as User
const fileItem: LibraryItem = {
  id: 'i1',
  title: 'Учебник алгебры',
  description: null,
  type: 'BOOK',
  url: null,
  fileId: 'f1',
  subjectId: null,
  gradeNumber: null,
  authorId: 't1',
  createdAt: '2026-11-01T00:00:00Z',
  file: { id: 'f1', name: 'algebra.pdf', size: 5 * 1024 * 1024, mime: 'application/pdf' },
}

const renderPage = () =>
  render(
    <AntdApp>
      <LibraryPage />
    </AntdApp>,
  )

beforeEach(() => {
  ;[httpGet, list, create, update].forEach((m) => m.mockReset())
  httpGet.mockResolvedValue({ data: [] })
  list.mockResolvedValue([fileItem])
  useAuthStore.setState({ user: teacher, token: 't' } as never)
})

describe('LibraryPage — материал ссылкой или файлом', () => {
  it('в форме можно переключиться со ссылки на файл: поле ссылки уходит, появляется выбор файла и лимиты', async () => {
    renderPage()
    await screen.findByText('Учебник алгебры')
    fireEvent.click(screen.getByText('Добавить материал'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByPlaceholderText('https://…')).toBeTruthy() // по умолчанию — ссылка
    expect(within(dialog).queryByText('Выбрать файл')).toBeNull()

    fireEvent.click(within(dialog).getByText('📎 Файл'))
    expect(await within(dialog).findByText('Выбрать файл')).toBeTruthy()
    expect(within(dialog).queryByPlaceholderText('https://…')).toBeNull()
    expect(within(dialog).getByText(/до 20 МБ, видео — до 100 МБ/)).toBeTruthy()

    // без файла сохранить нельзя
    fireEvent.click(within(dialog).getByText('Добавить'))
    expect(await within(dialog).findByText('Загрузите файл')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it('при правке материала-файла форма открывается в режиме «Файл» с текущим файлом', async () => {
    const { container } = renderPage()
    await screen.findByText('Учебник алгебры')
    const edit = container.querySelector('.anticon-edit')!.closest('button')!
    fireEvent.click(edit)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Редактировать материал')).toBeTruthy()
    expect(await within(dialog).findByText('algebra.pdf')).toBeTruthy()
    expect(within(dialog).getByText('Выбрать другой файл')).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it('карточка библиотеки показывает файл и размер', async () => {
    renderPage()
    expect(await screen.findByText('algebra.pdf · 5 МБ')).toBeTruthy()
  })
})
