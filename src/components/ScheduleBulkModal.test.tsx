import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api', () => ({ http: { post: vi.fn() } }))

import { http } from '../api'
import ScheduleBulkModal, { type ExistingLesson } from './ScheduleBulkModal'

vi.setConfig({ testTimeout: 60_000 })
configure({ asyncUtilTimeout: 10_000 })

const groups = [{ id: 'g1', name: '5А' }]
const subjects = [
  { id: 'math', name: 'Математика', color: '#0D7A7C' },
  { id: 'art', name: 'Рисование', color: '#FF8A65' },
]
const teachers = [{ id: 'u1', name: 'Рахимова Нигина', groupIds: ['g1'], subjectIds: ['math'] }]

function renderModal(extra: Partial<Parameters<typeof ScheduleBulkModal>[0]> = {}) {
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(
    <AntdApp>
      <ScheduleBulkModal
        open
        onClose={onClose}
        onSaved={onSaved}
        groups={groups}
        subjects={subjects}
        teachers={teachers}
        isSchool
        existing={[]}
        defaultGroupId="g1"
        defaultDays={[]}
        {...extra}
      />
    </AntdApp>,
  )
  return { onSaved, onClose }
}

/** Оставить один урок в дне: меняем шаблон и жмём «Заполнить время» (быстрее, чем убирать строки по одной). */
async function oneLesson() {
  fireEvent.change(await screen.findByLabelText('Уроков в дне'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: /Заполнить время/ }))
  await waitFor(() => expect(screen.queryByLabelText('Начало урока 2')).not.toBeInTheDocument())
}

async function pickSubject(n: number, name: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: `Предмет урока ${n}` }))
  fireEvent.click((await screen.findAllByTitle(name))[0])
}

describe('ScheduleBulkModal — добавить уроки пачкой', () => {
  beforeEach(() => {
    vi.mocked(http.post).mockReset()
  })

  it('сразу шесть уроков со звонками; кнопка показывает итог: уроков в день × выбранные дни', async () => {
    renderModal()

    expect(await screen.findByLabelText('Начало урока 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Добавить уроки' })).toBeDisabled() // дни не выбраны
    fireEvent.click(screen.getByRole('button', { name: 'Пн–Пт' }))
    expect(await screen.findByRole('button', { name: 'Добавить уроки (30)' })).toBeEnabled() // 6 × 5
  })

  it('«Пн–Пт», предмет первому уроку: учитель подставляется сам, одним запросом уходят все уроки', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { created: 5, skipped: 0, replaced: 0 } } as never)
    const { onSaved, onClose } = renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Пн–Пт' }))
    await oneLesson()
    await pickSubject(1, 'Математика')
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить уроки (5)' }))

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1))
    expect(http.post).toHaveBeenCalledWith('/v1/schedule/bulk', {
      groupId: 'g1',
      days: [1, 2, 3, 4, 5],
      replace: false,
      lessons: [{ startTime: '08:00', endTime: '08:45', subjectId: 'math', teacherId: 'u1', room: undefined, activity: undefined }],
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('урок без предмета: понятная ошибка, запрос не уходит', async () => {
    renderModal({ defaultDays: [1] })

    fireEvent.click(await screen.findByRole('button', { name: 'Добавить уроки (6)' }))

    expect(await screen.findByText('Урок 1: выберите предмет')).toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('«Добавить урок» ставит следующий после последнего с переменой', async () => {
    renderModal({ defaultDays: [1] })
    fireEvent.click(await screen.findByRole('button', { name: 'Убрать урок 6' }))
    fireEvent.click(screen.getByRole('button', { name: /Добавить урок$/ }))

    // у пятого урока по шаблону конец 12:25: перемена 10 минут → новый урок начинается в 12:35
    await waitFor(() => expect(screen.getByLabelText('Начало урока 6')).toBeInTheDocument())
    expect((screen.getByLabelText('Начало урока 6') as HTMLInputElement).value).toBe('12:35')
  })

  it('у класса уже есть уроки в выбранные дни: подсказка и «Заменить их»; replace уходит в запросе', async () => {
    const existing: ExistingLesson[] = [
      { id: 'e1', groupId: 'g1', dayOfWeek: 1, startTime: '08:00', endTime: '08:45', activity: 'Математика', subjectId: 'math' },
    ]
    vi.mocked(http.post).mockResolvedValue({ data: { created: 1, skipped: 0, replaced: 1 } } as never)
    renderModal({ existing, defaultDays: [1] })

    expect(await screen.findByText(/уже есть уроки: 1/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Заменить их/ }))
    await oneLesson()
    await pickSubject(1, 'Рисование')
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить уроки (1)' }))

    await waitFor(() => expect(http.post).toHaveBeenCalled())
    expect(vi.mocked(http.post).mock.calls[0][1]).toMatchObject({ replace: true, days: [1] })
  })

  it('«Скопировать день» заполняет уроки из уже внесённого дня', async () => {
    const existing: ExistingLesson[] = [
      { id: 'e1', groupId: 'g1', dayOfWeek: 2, startTime: '09:00', endTime: '09:40', activity: 'Математика', subjectId: 'math', teacherId: 'u1', room: '12' },
      { id: 'e2', groupId: 'g1', dayOfWeek: 2, startTime: '09:50', endTime: '10:30', activity: 'Рисование', subjectId: 'art' },
    ]
    renderModal({ existing, defaultDays: [3] })

    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Скопировать день' }))
    fireEvent.click((await screen.findAllByTitle('Скопировать: Вторник'))[0])

    await waitFor(() => expect(screen.queryByLabelText('Начало урока 3')).not.toBeInTheDocument())
    expect((screen.getByLabelText('Начало урока 1') as HTMLInputElement).value).toBe('09:00')
    expect((screen.getByLabelText('Конец урока 2') as HTMLInputElement).value).toBe('10:30')
    expect(screen.getByRole('button', { name: 'Добавить уроки (2)' })).toBeInTheDocument()
  })
})
