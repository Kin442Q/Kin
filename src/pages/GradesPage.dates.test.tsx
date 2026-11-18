import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// Четверть: 2 ноября — 28 декабря 2026. Предмет идёт по понедельникам и средам.
const TERM = { id: 't2', name: '2 четверть', type: 'QUARTER', startDate: '2026-11-02', endDate: '2026-12-28' }

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(async () => ({ data: {} })),
  delete: vi.fn(async () => ({ data: {} })),
}))
vi.mock('../api', () => ({ http }))
vi.mock('../api/termsApi', () => ({
  termsApi: { list: async () => [TERM] },
}))

import { App as AntdApp } from 'antd'
import GradesPage from './GradesPage'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'

// Две оценки: 2 ноября (10) и 7 декабря (6) → средний балл за четверть 8.0.
const GRADES = [
  { id: 'g1', studentId: 'c1', subjectId: 's1', value: 10, type: 'CLASSWORK', date: '2026-11-02', comment: null, authorId: 'u1' },
  { id: 'g2', studentId: 'c1', subjectId: 's1', value: 6, type: 'CLASSWORK', date: '2026-12-07', comment: null, authorId: 'u1' },
]

const dayColumns = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.gj-date-d')).map((e) => e.textContent)

async function pickOption(container: HTMLElement, selectIndex: number, optionText: string) {
  const selects = container.querySelectorAll('.ant-select')
  fireEvent.mouseDown(selects[selectIndex].querySelector('.ant-select-selector') as Element)
  const option = await screen.findByTitle(optionText, undefined, { timeout: 4000 })
  fireEvent.click(option)
}

async function openJournal() {
  const view = render(
    <AntdApp>
      <GradesPage />
    </AntdApp>,
  )
  // фильтры появляются, когда загрузились предметы
  await waitFor(() => expect(view.container.querySelectorAll('.ant-select').length).toBe(3), { timeout: 4000 })
  await pickOption(view.container, 0, '11b') // класс
  await pickOption(view.container, 1, 'Алгебра') // предмет
  await waitFor(() => expect(dayColumns(view.container).length).toBeGreaterThan(0), { timeout: 4000 })
  return view
}

/** Выбираем диапазон: вводим даты в оба поля RangePicker и подтверждаем Enter. */
function pickRange(container: HTMLElement, from: string, to: string) {
  const [start, end] = Array.from(
    container.querySelectorAll('.ant-picker-range input'),
  ) as HTMLInputElement[]
  fireEvent.mouseDown(start)
  fireEvent.focus(start)
  fireEvent.change(start, { target: { value: from } })
  fireEvent.keyDown(start, { key: 'Enter', keyCode: 13 })
  fireEvent.mouseDown(end)
  fireEvent.focus(end)
  fireEvent.change(end, { target: { value: to } })
  fireEvent.keyDown(end, { key: 'Enter', keyCode: 13 })
}

describe('Журнал оценок: фильтр по датам', () => {
  beforeEach(() => {
    http.get.mockReset()
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/subjects') return { data: [{ id: 's1', name: 'Алгебра', color: '#3B8FBF' }] }
      if (url === '/v1/schedule') return { data: [{ dayOfWeek: 1, subjectId: 's1' }, { dayOfWeek: 3, subjectId: 's1' }] }
      if (url === '/v1/grades') return { data: GRADES }
      return { data: [] }
    })
    useAuthStore.setState({
      user: { id: 'u1', fullName: 'Учитель', email: 't@x.tj', role: 'TEACHER', kindergartenId: 'k1' } as never,
      token: 'tok',
    })
    useDataStore.setState({
      groups: [{ id: 'g1', name: '11b' }] as never,
      children: [{ id: 'c1', firstName: 'Sher', lastName: 'Rustamov', groupId: 'g1' }] as never,
    })
  })

  it('по умолчанию показаны все уроки четверти, «Сбросить» неактивна', async () => {
    const { container } = await openJournal()
    // понедельники (9) + среды (8) в пределах 2 ноября — 28 декабря
    expect(dayColumns(container)).toHaveLength(17)
    expect(screen.getByRole('button', { name: 'Сбросить' })).toBeDisabled()
    expect(screen.queryByText(/считаются по всей четверти/)).not.toBeInTheDocument()
  })

  it('выбор диапазона сужает колонки, средний балл остаётся за всю четверть, «Сбросить» возвращает всё', async () => {
    const { container } = await openJournal()
    expect(screen.getByText('8.0')).toBeInTheDocument() // (10 + 6) / 2 за всю четверть

    pickRange(container, '09.11.2026', '18.11.2026')

    // 9 пн, 11 ср, 16 пн, 18 ср
    await waitFor(() => expect(dayColumns(container)).toEqual(['09', '11', '16', '18']), { timeout: 4000 })
    expect(screen.getByText(/считаются по всей четверти/)).toBeInTheDocument()
    // оценка 10 за 2 ноября ушла из колонок, но в средний балл по-прежнему входит
    expect(within(container.querySelector('table.gj') as HTMLElement).queryByText('10')).not.toBeInTheDocument()
    expect(screen.getByText('8.0')).toBeInTheDocument()

    const reset = screen.getByRole('button', { name: 'Сбросить' })
    expect(reset).toBeEnabled()
    fireEvent.click(reset)
    await waitFor(() => expect(dayColumns(container)).toHaveLength(17), { timeout: 4000 })
    expect(screen.queryByText(/считаются по всей четверти/)).not.toBeInTheDocument()
  })
})
