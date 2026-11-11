import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Настоящий отчёт строит серверный расчёт на небольших, но «живых» данных: низкие отметки, пропуски, расписание.
vi.mock('../api/directorReportsApi', async () => {
  const { buildEducationReport } = await import('../../server/src/modules/director-reports/report')
  const grade = (studentId: string, subjectId: string, value: number, date: string, type = 'CLASSWORK') => ({ studentId, subjectId, authorId: 't1', date, type, value })
  const report = buildEducationReport({
    from: '2026-11-01',
    to: '2026-11-30',
    effectiveTo: '2026-11-10',
    generatedAt: '2026-11-10T10:00:00Z',
    scale: 'five',
    thresholds: { pass: 3, quality: 4, excellent: 5 },
    groups: [{ id: 'g1', name: '5А', homeroomTeacher: 'Учитель Т', students: [{ id: 'a', name: 'Али' }, { id: 'b', name: 'Мадина' }] }],
    subjects: [{ id: 'math', name: 'Математика' }, { id: 'rus', name: 'Русский язык' }],
    schedule: [
      { groupId: 'g1', subjectId: 'math', teacherId: 't1', dayOfWeek: 1, startTime: '08:00', endTime: '08:45' },
      { groupId: 'g1', subjectId: 'rus', teacherId: 't1', dayOfWeek: 2, startTime: '08:00', endTime: '08:45' },
    ],
    grades: [grade('a', 'math', 2, '2026-11-03'), grade('a', 'math', 4, '2026-11-04', 'CONTROL'), grade('b', 'math', 5, '2026-11-03', 'EXAM')],
    attendance: [
      { studentId: 'a', groupId: 'g1', date: '2026-11-03', status: 'ABSENT' },
      { studentId: 'a', groupId: 'g1', date: '2026-11-04', status: 'ABSENT' },
      { studentId: 'a', groupId: 'g1', date: '2026-11-05', status: 'ABSENT' },
      { studentId: 'b', groupId: 'g1', date: '2026-11-03', status: 'PRESENT' },
    ],
    teachers: [{ id: 't1', name: 'Учитель Т', active: true }],
    homework: [{ groupId: 'g1', authorId: 't1', dueDate: '2026-11-05', submissions: [] }],
    movements: [],
  })
  return { directorReportsApi: { overview: async () => report, export: async () => report } }
})
vi.mock('../api/termsApi', () => ({ termsApi: { list: async () => [] } }))

import DirectorReportPage from './DirectorReportPage'

/** Значки-подсказки в заголовках таблицы текущей вкладки. */
const helpHeaders = (container: HTMLElement) => container.querySelectorAll('th span[tabindex="0"]')

describe('Отчёты для директора: подсказки в таблицах', () => {
  it('таблица «Каждый класс» подписана, а её колонки поясняют, что считают', async () => {
    const { container } = render(<DirectorReportPage />)
    await screen.findByText('Каждый класс')
    // название таблицы — со значком, который открывается с клавиатуры
    expect(screen.getByText('Каждый класс').closest('span[tabindex="0"]')).not.toBeNull()
    // колонки «Средний балл», «Охват оцениванием», «Оценённых учеников» … получили значки
    expect(helpHeaders(container).length).toBeGreaterThanOrEqual(5)
    // сами значения таблицы на месте: класс и его ученики
    const table = screen.getByText('5А')
    expect(table).toBeInTheDocument()
  })

  it('ячейка поясняет значение при наведении: строка, колонка и на чём основано', async () => {
    const user = userEvent.setup()
    const { container } = render(<DirectorReportPage />)
    await screen.findByText('Каждый класс')
    const row = screen.getByText('5А').closest('tr') as HTMLElement
    // «Текущих отметок» — число отметок класса: наводим на него
    const cell = within(row).getAllByText('3')[0]
    await user.hover(cell)
    const tip = await screen.findByRole('tooltip', undefined, { timeout: 4000 })
    expect(tip).toHaveTextContent('5А')
    expect(tip).toHaveTextContent('Сколько отметок поставлено в журнал')
    expect(container).toBeTruthy()
  })

  it.each([
    ['Учебная поддержка', 'Ученики, которым может понадобиться помощь'],
    ['Журналы и учебный план', 'Охват оцениванием по каждой паре'],
    ['Кадры и нагрузка', 'Недельная нагрузка учителей'],
  ])('вкладка «%s»: таблица с названием-подсказкой и пояснениями колонок', async (tab, whatFragment) => {
    const user = userEvent.setup()
    const { container } = render(<DirectorReportPage />)
    await screen.findByText('Каждый класс')
    await user.click(screen.getByRole('tab', { name: tab }))
    const heading = await screen.findAllByText(tab)
    // название таблицы-подсказки (h3) — отдельный от вкладки элемент
    const title = heading.find((el) => el.closest('h3'))
    expect(title).toBeTruthy()
    await user.hover(title!)
    const tip = await screen.findByRole('tooltip', undefined, { timeout: 4000 })
    expect(tip).toHaveTextContent(whatFragment)
    await waitFor(() => expect(helpHeaders(container).length).toBeGreaterThan(0))
  })
})
