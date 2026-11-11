import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App as AntdApp } from 'antd'

const list = vi.fn()
const fileLink = vi.fn()
vi.mock('../../api/lessonMaterialApi', async (orig) => {
  const actual = await orig<typeof import('../../api/lessonMaterialApi')>()
  return { ...actual, lessonMaterialApi: { ...actual.lessonMaterialApi, list: (...a: unknown[]) => list(...a), fileLink: (...a: unknown[]) => fileLink(...a) } }
})
const openFileLink = vi.fn()
vi.mock('../../api/filesApi', async (orig) => {
  const actual = await orig<typeof import('../../api/filesApi')>()
  return { ...actual, openFileLink: (...a: unknown[]) => openFileLink(...a) }
})

import StudentMaterialsPage from './StudentMaterialsPage'
import type { LessonMaterial } from '../../api/lessonMaterialApi'

const base = { createdAt: '2026-11-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z', description: null, url: null, author: { id: 't1', fullName: 'Мария Иванова' }, file: null }
const materials: LessonMaterial[] = [
  { ...base, id: 'm1', title: 'Тема 5: дроби', daysLeft: 30, subject: { id: 's1', name: 'Математика', color: '#4FB286' }, group: { id: 'g1', name: '7А' }, file: { id: 'f1', name: 'drobi.pdf', size: 3 * 1024 * 1024, mime: 'application/pdf' }, description: 'Прочитать главу 5' },
  { ...base, id: 'm2', title: 'Видео про дроби', daysLeft: 2, subject: { id: 's1', name: 'Математика', color: '#4FB286' }, group: { id: 'g1', name: '7А' }, url: 'https://youtu.be/abc' },
  { ...base, id: 'm3', title: 'Памятка по русскому', daysLeft: 0, subject: null, group: { id: 'g1', name: '7А' }, description: 'Повторить правила' },
]

const renderPage = () =>
  render(
    <AntdApp>
      <StudentMaterialsPage />
    </AntdApp>,
  )

beforeEach(() => {
  list.mockReset()
  fileLink.mockReset()
  openFileLink.mockReset()
  openFileLink.mockResolvedValue(undefined)
})

describe('StudentMaterialsPage', () => {
  it('материалы сгруппированы по предметам, у каждого видно срок до удаления', async () => {
    list.mockResolvedValue(materials)
    renderPage()

    expect(await screen.findByText('Тема 5: дроби')).toBeTruthy()
    expect(screen.getByLabelText('Математика')).toBeTruthy()
    expect(screen.getByLabelText('Без предмета')).toBeTruthy()
    expect(screen.getByText('удалится через 30 дней')).toBeTruthy()
    expect(screen.getByText('удалится через 2 дня')).toBeTruthy()
    expect(screen.getByText('удалится сегодня')).toBeTruthy()
    // состав групп: два материала по математике, один — без предмета
    const math = within(screen.getByLabelText('Математика'))
    expect(math.getByText('Тема 5: дроби')).toBeTruthy()
    expect(math.getByText('Видео про дроби')).toBeTruthy()
    expect(math.queryByText('Памятка по русскому')).toBeNull()
    const other = within(screen.getByLabelText('Без предмета'))
    expect(other.getByText('Памятка по русскому')).toBeTruthy()
    expect(other.queryByText('Тема 5: дроби')).toBeNull()
    expect(screen.getByText('Прочитать главу 5')).toBeTruthy()
  })

  it('файл открывается через ссылку сервера, ссылка-материал — обычной ссылкой', async () => {
    list.mockResolvedValue(materials)
    renderPage()

    const openBtn = await screen.findByText(/Открыть файл · 3 МБ/)
    fireEvent.click(openBtn)
    expect(openFileLink).toHaveBeenCalledTimes(1)
    // функция, которую страница передала, запрашивает ссылку именно этого материала
    fileLink.mockResolvedValue({})
    await (openFileLink.mock.calls[0][0] as () => Promise<unknown>)()
    expect(fileLink).toHaveBeenCalledWith('m1')

    const linkBtn = screen.getByText('Ссылка').closest('a') as HTMLAnchorElement
    expect(linkBtn.getAttribute('href')).toBe('https://youtu.be/abc')
    expect(linkBtn.getAttribute('target')).toBe('_blank')
    expect(linkBtn.getAttribute('rel')).toContain('noopener')
  })

  it('пока материалов нет — понятная заглушка', async () => {
    list.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Материалов пока нет')).toBeTruthy()
  })

  it('ошибка загрузки не роняет страницу', async () => {
    list.mockRejectedValue({ response: { data: { message: 'Раздел отключён' } } })
    renderPage()
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(await screen.findByText('Материалов пока нет')).toBeTruthy()
  })
})
