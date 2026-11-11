import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { App as AntdApp } from 'antd'

const fileLink = vi.fn()
vi.mock('../api/learningApi', async (orig) => {
  const actual = await orig<typeof import('../api/learningApi')>()
  return { ...actual, libraryApi: { ...actual.libraryApi, fileLink: (...a: unknown[]) => fileLink(...a) } }
})
const openFileLink = vi.fn()
vi.mock('../api/filesApi', async (orig) => {
  const actual = await orig<typeof import('../api/filesApi')>()
  return { ...actual, openFileLink: (...a: unknown[]) => openFileLink(...a) }
})

import LibraryCard from './LibraryCard'
import type { LibraryItem } from '../api/learningApi'

const item: LibraryItem = {
  id: 'i1',
  title: 'Учебник алгебры',
  description: null,
  type: 'BOOK',
  url: 'https://example.org/algebra.pdf',
  fileId: null,
  subjectId: null,
  gradeNumber: null,
  authorId: 't1',
  createdAt: '2026-11-01T00:00:00Z',
}

const renderCard = (i: LibraryItem) =>
  render(
    <AntdApp>
      <LibraryCard item={i} />
    </AntdApp>,
  )

beforeEach(() => {
  fileLink.mockReset()
  openFileLink.mockReset()
  openFileLink.mockResolvedValue(undefined)
})

describe('LibraryCard', () => {
  it('материал-ссылка открывается обычной ссылкой в новой вкладке', () => {
    renderCard(item)
    const a = screen.getByText('Открыть').closest('a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('https://example.org/algebra.pdf')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
  })

  it('материал-файл: имя и размер на карточке, открытие — через ссылку сервера, не напрямую', async () => {
    renderCard({ ...item, url: null, fileId: 'f1', file: { id: 'f1', name: 'algebra.pdf', size: 5 * 1024 * 1024, mime: 'application/pdf' } })

    expect(screen.getByText('algebra.pdf · 5 МБ')).toBeTruthy()
    const btn = screen.getByText('Открыть').closest('button') as HTMLButtonElement
    expect(btn.closest('a')).toBeNull() // не <a href=url>: у файла адреса нет
    fireEvent.click(btn)

    expect(openFileLink).toHaveBeenCalledTimes(1)
    fileLink.mockResolvedValue({})
    await (openFileLink.mock.calls[0][0] as () => Promise<unknown>)()
    expect(fileLink).toHaveBeenCalledWith('i1')
  })

  it('отказ сервера при открытии файла — сообщение, карточка не ломается', async () => {
    openFileLink.mockRejectedValue({ response: { data: { message: 'Файл удалён' } } })
    renderCard({ ...item, url: null, file: { id: 'f1', name: 'a.pdf', size: 10, mime: 'application/pdf' } })
    fireEvent.click(screen.getByText('Открыть'))
    expect(await screen.findByText('Файл удалён')).toBeTruthy()
    expect(screen.getByText('Учебник алгебры')).toBeTruthy()
  })
})
