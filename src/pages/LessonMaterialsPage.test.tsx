import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App as AntdApp } from 'antd'

const httpGet = vi.fn()
vi.mock('../api', () => ({ http: { get: (...a: unknown[]) => httpGet(...a) } }))

const list = vi.fn()
const create = vi.fn()
const remove = vi.fn()
vi.mock('../api/lessonMaterialApi', async (orig) => {
  const actual = await orig<typeof import('../api/lessonMaterialApi')>()
  return {
    ...actual,
    lessonMaterialApi: {
      ...actual.lessonMaterialApi,
      list: (...a: unknown[]) => list(...a),
      create: (...a: unknown[]) => create(...a),
      remove: (...a: unknown[]) => remove(...a),
    },
  }
})
const usage = vi.fn()
vi.mock('../api/filesApi', async (orig) => {
  const actual = await orig<typeof import('../api/filesApi')>()
  return { ...actual, filesApi: { usage: (...a: unknown[]) => usage(...a) } }
})

import LessonMaterialsPage from './LessonMaterialsPage'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import type { LessonMaterial } from '../api/lessonMaterialApi'
import type { User } from '../types'

const MB = 1024 * 1024
const admin = { id: 'a1', fullName: 'Директор', email: 'd@s.tj', role: 'ADMIN', kindergartenId: 'k1' } as unknown as User
const teacher = { id: 't1', fullName: 'Мария Иванова', email: 't@s.tj', role: 'TEACHER', kindergartenId: 'k1' } as unknown as User

const subject = { id: 's1', name: 'Математика', color: '#4FB286' }
const mine: LessonMaterial = {
  id: 'm1',
  title: 'Конспект: дроби',
  description: 'Прочитать главу 5',
  url: null,
  createdAt: '2026-11-01T00:00:00Z',
  expiresAt: '2026-12-01T00:00:00Z',
  daysLeft: 28,
  subject,
  group: { id: 'g1', name: '7А' },
  author: { id: 't1', fullName: 'Мария Иванова' },
  file: { id: 'f1', name: 'Конспект — дроби.pdf', size: 3 * MB, mime: 'application/pdf' },
}
const others: LessonMaterial = {
  id: 'm2',
  title: 'Задачи от Олега',
  description: null,
  url: 'https://example.org/x',
  createdAt: '2026-11-01T00:00:00Z',
  expiresAt: '2026-11-04T00:00:00Z',
  daysLeft: 2,
  subject: null,
  group: { id: 'g1', name: '7А' },
  author: { id: 't2', fullName: 'Олег Петров' },
  file: null,
}

const renderPage = () =>
  render(
    <AntdApp>
      <LessonMaterialsPage />
    </AntdApp>,
  )

beforeEach(() => {
  ;[httpGet, list, create, remove, usage].forEach((m) => m.mockReset())
  httpGet.mockResolvedValue({ data: [subject] })
  list.mockResolvedValue([mine, others])
  usage.mockResolvedValue({ usedBytes: 5 * MB, quotaBytes: 2048 * MB, files: 2 })
  useAuthStore.setState({ user: admin, token: 't' } as never)
  useDataStore.setState({ groups: [{ id: 'g1', name: '7А' }] } as never)
})

describe('LessonMaterialsPage', () => {
  it('таблица: название, файл с размером, срок до удаления; админ видит занятое место', async () => {
    renderPage()
    expect(await screen.findByText('Конспект: дроби')).toBeTruthy()
    expect(screen.getByText(/Конспект — дроби\.pdf · 3 МБ/)).toBeTruthy()
    expect(screen.getByText('удалится через 28 дней')).toBeTruthy()
    expect(screen.getByText('удалится через 2 дня')).toBeTruthy()
    expect(await screen.findByText('Занято 5 МБ из 2048 МБ')).toBeTruthy()
    // админ может удалить любой материал
    expect(screen.getAllByLabelText('Удалить материал')).toHaveLength(2)
  })

  it('учитель: полосы места нет, удалить можно только свой материал', async () => {
    useAuthStore.setState({ user: teacher, token: 't' } as never)
    renderPage()
    expect(await screen.findByText('Конспект: дроби')).toBeTruthy()
    expect(usage).not.toHaveBeenCalled()
    expect(screen.queryByTestId('storage-usage')).toBeNull()
    expect(screen.getAllByLabelText('Удалить материал')).toHaveLength(1)
  })

  it('«Новый материал» открывает форму со сроком хранения; пустая форма не уходит на сервер', async () => {
    renderPage()
    await screen.findByText('Конспект: дроби')
    fireEvent.click(screen.getByText('Новый материал'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Новый материал к уроку')).toBeTruthy()
    expect(within(dialog).getByText(/удалится сам вместе с файлом/)).toBeTruthy()
    expect(within(dialog).getByText('Выбрать файл')).toBeTruthy()

    fireEvent.click(within(dialog).getByText('Выложить'))
    expect(await within(dialog).findByText('Введите название')).toBeTruthy()
    // единственный класс выбран сразу — ошибки про класс нет
    expect(within(dialog).queryByText('Выберите класс')).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('ошибка загрузки списка не роняет страницу', async () => {
    list.mockRejectedValue({ response: { data: { message: 'Раздел отключён' } } })
    renderPage()
    expect(await screen.findByText('Раздел отключён')).toBeTruthy()
    expect(screen.getByText('Материалы к уроку')).toBeTruthy()
    await waitFor(() => expect(list).toHaveBeenCalled())
  })
})
