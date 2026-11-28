import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const TERM = { id: 't2', name: '2 четверть', type: 'QUARTER', startDate: '2026-11-02', endDate: '2026-12-28' }

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(async () => ({ data: {} })),
  delete: vi.fn(async () => ({ data: {} })),
}))
const api = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn(), reset: vi.fn() }))
vi.mock('../api', () => ({ http }))
vi.mock('../api/termsApi', () => ({ termsApi: { list: async () => [TERM] } }))
vi.mock('../api/termGradesApi', () => ({ termGradesApi: api }))

import { App as AntdApp } from 'antd'
import GradesPage from './GradesPage'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import type { Role } from '../types'

const calc = (value: number | null, average: number | null, count: number) => ({
  value,
  average,
  count,
  asOf: count ? '2026-11-20' : null,
  reason: value === null ? 'NO_GRADES' : null,
})

/** c1 — расчётный итог, c2 — поставил учитель (расчёт другой). */
const SYSTEM_ITEM = {
  studentId: 'c1',
  value: 4,
  source: 'SYSTEM',
  date: '2026-11-20',
  manual: null,
  calculated: calc(4, 3.67, 3),
}
const MANUAL_ITEM = {
  studentId: 'c2',
  value: 5,
  source: 'TEACHER',
  date: '2026-11-25T08:00:00.000Z',
  manual: { value: 5, setAt: '2026-11-25T08:00:00.000Z', setBy: { id: 'u1', fullName: 'Мария Ивановна' } },
  calculated: calc(3, 3, 2),
}

const signIn = (role: Role) =>
  useAuthStore.setState({
    user: { id: 'u1', fullName: 'Тест', email: 't@x.tj', role, kindergartenId: 'k1' } as never,
    token: 'tok',
  })

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
  await waitFor(() => expect(view.container.querySelectorAll('.ant-select').length).toBe(3), { timeout: 4000 })
  await pickOption(view.container, 0, '11b')
  await pickOption(view.container, 1, 'Алгебра')
  await waitFor(() => expect(view.container.querySelector('table.gj .gj-term-mark.is-teacher')).not.toBeNull(), {
    timeout: 4000,
  })
  return view
}

const dialog = () => screen.getByRole('dialog')
const input = () => within(dialog()).getByRole('spinbutton', { name: 'Итоговая оценка' }) as HTMLInputElement
// У кнопок antd значок входит в доступное имя, поэтому имя ищем по вхождению.
const button = (name: RegExp) => within(dialog()).getByRole('button', { name })

// Страница с antd на холодном запуске всего набора отрисовывается дольше стандартных 5 секунд.
describe('Журнал оценок: итог четверти', { timeout: 20_000 }, () => {
  beforeEach(() => {
    http.get.mockReset()
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/subjects') return { data: [{ id: 's1', name: 'Алгебра', color: '#3B8FBF' }] }
      return { data: [] }
    })
    api.list.mockReset().mockResolvedValue({ scaleMax: 5, items: [SYSTEM_ITEM, MANUAL_ITEM] })
    api.set.mockReset()
    api.reset.mockReset()
    signIn('TEACHER')
    useDataStore.setState({
      groups: [{ id: 'g1', name: '11b' }] as never,
      children: [
        { id: 'c1', firstName: 'Шер', lastName: 'Рустамов', groupId: 'g1' },
        { id: 'c2', firstName: 'Нигина', lastName: 'Саидова', groupId: 'g1' },
      ] as never,
    })
  })

  it('в колонке «Чет.» отмечено, где расчёт, а где поставил учитель', async () => {
    const { container } = await openJournal()
    expect(api.list).toHaveBeenCalledWith({ termId: 't2', subjectId: 's1', groupId: 'g1' })
    const marks = Array.from(container.querySelectorAll('table.gj .gj-term-mark'))
    expect(marks.map((m) => [m.textContent, m.classList.contains('is-teacher'), m.classList.contains('is-system')])).toEqual([
      ['4', false, true],
      ['5', true, false],
    ])
    expect(marks[0].getAttribute('title')).toBe('Расчётная: средний балл 3.67, оценок: 3')
    expect(marks[1].getAttribute('title')).toContain('Поставил учитель')
    expect(marks[1].getAttribute('title')).toContain('расчёт: 3')
  })

  it('«Посчитать автоматически» подставляет расчёт, но сохраняет только «Сохранить»', async () => {
    api.set.mockResolvedValue({
      scaleMax: 5,
      item: {
        ...SYSTEM_ITEM,
        source: 'TEACHER',
        manual: { value: 4, setAt: '2026-11-26T08:00:00.000Z', setBy: null },
      },
    })
    const { container } = await openJournal()
    fireEvent.click(screen.getByRole('button', { name: 'Итог четверти: Шер Рустамов — 4' }))

    expect(input().value).toBe('') // расчёт сам в поле не попадает
    expect(button(/Сохранить/)).toBeDisabled()
    expect(within(dialog()).queryByRole('button', { name: /Сбросить/ })).not.toBeInTheDocument()

    fireEvent.click(button(/Посчитать автоматически/))
    expect(input().value).toBe('4')
    expect(api.set).not.toHaveBeenCalled()

    fireEvent.click(button(/Сохранить/))
    await waitFor(() =>
      expect(api.set).toHaveBeenCalledWith({ termId: 't2', subjectId: 's1', studentId: 'c1', value: 4 }),
    )
    await waitFor(() => expect(container.querySelectorAll('table.gj .gj-term-mark.is-teacher')).toHaveLength(2))
  })

  it('оценку учителя можно изменить и сбросить — тогда снова расчётная', async () => {
    api.reset.mockResolvedValue({
      scaleMax: 5,
      item: { ...MANUAL_ITEM, value: 3, source: 'SYSTEM', date: '2026-11-20', manual: null },
    })
    const { container } = await openJournal()
    fireEvent.click(screen.getByRole('button', { name: 'Итог четверти: Нигина Саидова — 5' }))

    expect(input().value).toBe('5')
    expect(button(/Сохранить/)).toBeDisabled() // ничего не изменено
    expect(within(dialog()).getByText(/поставил учитель Мария Ивановна, 25\.11\.2026/)).toBeInTheDocument()
    fireEvent.change(input(), { target: { value: '2' } })
    expect(button(/Сохранить/)).toBeEnabled()

    fireEvent.click(button(/Сбросить/))
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith({ termId: 't2', subjectId: 's1', studentId: 'c2' }))
    await waitFor(() => expect(container.querySelectorAll('table.gj .gj-term-mark.is-system')).toHaveLength(2))
    expect(api.set).not.toHaveBeenCalled()
  })

  it('директор видит итоги, но изменить не может', async () => {
    signIn('ADMIN')
    const { container } = await openJournal()
    expect(screen.queryByRole('button', { name: /Итог четверти:/ })).not.toBeInTheDocument()
    expect(container.querySelectorAll('table.gj span.gj-term-mark')).toHaveLength(2)
    fireEvent.click(container.querySelector('table.gj .gj-term-mark') as Element)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
