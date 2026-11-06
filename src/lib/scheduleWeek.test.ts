import { describe, it, expect } from 'vitest'

import { lessonsByDay, lessonsByGroup, shortName, teacherLessons, visibleDays, type WeekLesson } from './scheduleWeek'

const l = (id: string, groupId: string, day: number, start: string, teacherId?: string | null): WeekLesson => ({
  id,
  groupId,
  dayOfWeek: day,
  startTime: start,
  endTime: '23:59',
  activity: 'x',
  teacherId,
})

describe('уроки учителя на неделю', () => {
  it('уроки закреплены за учителями — только его', () => {
    const all = [l('1', 'g1', 1, '08:00', 'me'), l('2', 'g1', 1, '09:00', 'other'), l('3', 'g2', 2, '08:00', 'me')]
    expect(teacherLessons(all, 'me').map((x) => x.id)).toEqual(['1', '3'])
  })

  it('учителей в уроках нет — все уроки его классов (сервер отдаёт только их)', () => {
    const all = [l('1', 'g1', 1, '08:00'), l('2', 'g2', 2, '08:00', null)]
    expect(teacherLessons(all, 'me')).toHaveLength(2)
  })

  it('закреплён чужой, мои не закреплены — у меня пусто (как в мобильном приложении)', () => {
    expect(teacherLessons([l('1', 'g1', 1, '08:00', 'other')], 'me')).toEqual([])
  })
})

describe('неделя', () => {
  it('уроки по дням и по времени; пн–сб всегда, воскресенье только с уроками', () => {
    const byDay = lessonsByDay([l('b', 'g', 2, '09:00'), l('a', 'g', 2, '08:00'), l('c', 'g', 1, '10:00')])
    expect(byDay[2].map((x) => x.id)).toEqual(['a', 'b'])
    expect(visibleDays(byDay)).toEqual([1, 2, 3, 4, 5, 6])
    expect(visibleDays(lessonsByDay([l('s', 'g', 7, '10:00')]))).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('уроки по классам', () => {
    const map = lessonsByGroup([l('1', 'g1', 1, '08:00'), l('2', 'g2', 1, '08:00'), l('3', 'g1', 2, '08:00')])
    expect(map.get('g1')?.map((x) => x.id)).toEqual(['1', '3'])
    expect(map.get('g2')).toHaveLength(1)
    expect(map.get('g3')).toBeUndefined()
  })

  it('короткое имя: фамилия и инициал', () => {
    expect(shortName('Иванова Мария Петровна')).toBe('Иванова М.')
    expect(shortName('Иванова')).toBe('Иванова')
  })
})
