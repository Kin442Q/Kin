import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, configure } from '@testing-library/react'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

import WeekSchedule from './WeekSchedule'
import type { WeekLesson } from '../lib/scheduleWeek'

// Названия дней берутся из языка интерфейса: в приложении он русский
dayjs.locale('ru')

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 8_000 })

const lesson = (patch: Partial<WeekLesson> = {}): WeekLesson => ({
  id: 'l1',
  groupId: 'g1',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '08:45',
  activity: 'Математика',
  subject: { id: 's1', name: 'Математика', color: '#0D7A7C' },
  room: '12',
  teacherId: 'u1',
  ...patch,
})

describe('WeekSchedule — неделя уроков', () => {
  it('карточка на каждый день пн–сб; урок: время, предмет, класс, кабинет', () => {
    render(
      <WeekSchedule
        lessons={[lesson()]}
        groupName={(id) => (id === 'g1' ? '5А' : undefined)}
        todayText="Сегодня"
      />,
    )

    expect(screen.getAllByText('Уроков нет')).toHaveLength(5) // остальные пять дней пусты
    expect(screen.getByText('Математика')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('5А · каб. 12')).toBeInTheDocument()
  })

  it('в расписании класса вместо класса — учитель; кнопки «+» и удаления работают', () => {
    const onAddDay = vi.fn()
    const onRemove = vi.fn()
    render(
      <WeekSchedule
        lessons={[lesson()]}
        teacherName={(id) => (id === 'u1' ? 'Рахимова Нигина Олимовна' : undefined)}
        onAddDay={onAddDay}
        onRemove={onRemove}
      />,
    )

    expect(screen.getByText('Рахимова Н. · каб. 12')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Добавить уроки:/ })[0])
    expect(onAddDay).toHaveBeenCalledWith(1) // понедельник

    fireEvent.click(screen.getByRole('button', { name: 'Удалить урок' }))
    fireEvent.click(within(document.body).getByRole('button', { name: 'Удалить' }))
    expect(onRemove).toHaveBeenCalledWith('l1')
  })

  it('только для чтения: без кнопок «+» и удаления', () => {
    render(<WeekSchedule lessons={[lesson()]} />)
    expect(screen.queryByRole('button', { name: /Добавить уроки/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Удалить урок' })).not.toBeInTheDocument()
  })

  it('воскресенье появляется только если на него есть уроки', () => {
    const { unmount } = render(<WeekSchedule lessons={[lesson()]} />)
    expect(screen.queryByText('Воскресенье')).not.toBeInTheDocument()
    unmount()
    render(<WeekSchedule lessons={[lesson({ dayOfWeek: 7 })]} />)
    expect(screen.getByText('Воскресенье')).toBeInTheDocument()
  })
})
