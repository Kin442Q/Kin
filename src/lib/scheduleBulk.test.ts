import { describe, it, expect } from 'vitest'

import {
  DEFAULT_TEMPLATE,
  addMinutes,
  buildTimetable,
  findOverlap,
  nextSlot,
  pickTeacher,
  rowsFromTemplate,
  sortTeachers,
  toPayload,
  validateRows,
  type LessonRow,
  type TeacherOption,
} from './scheduleBulk'

const row = (patch: Partial<LessonRow> = {}): LessonRow => ({ key: Math.random().toString(36), start: '08:00', end: '08:45', subjectId: 'math', ...patch })

describe('звонки по шаблону', () => {
  it('6 уроков по 45 минут с переменой 10 от 08:00', () => {
    expect(buildTimetable(DEFAULT_TEMPLATE)).toEqual([
      { start: '08:00', end: '08:45' },
      { start: '08:55', end: '09:40' },
      { start: '09:50', end: '10:35' },
      { start: '10:45', end: '11:30' },
      { start: '11:40', end: '12:25' },
      { start: '12:35', end: '13:20' },
    ])
  })

  it('что не влезает в сутки, отбрасывается; больше 20 уроков не бывает', () => {
    expect(buildTimetable({ count: 5, start: '22:00', lessonMin: 45, breakMin: 10 })).toHaveLength(2)
    expect(buildTimetable({ count: 99, start: '00:00', lessonMin: 10, breakMin: 0 })).toHaveLength(20)
  })

  it('addMinutes не уходит за полночь и не уходит в минус', () => {
    expect(addMinutes('08:00', 45)).toBe('08:45')
    expect(addMinutes('23:50', 30)).toBe('23:59')
    expect(addMinutes('00:10', -30)).toBe('00:00')
  })

  it('следующий урок: после последнего плюс перемена; пустой список — начало шаблона', () => {
    expect(nextSlot([], DEFAULT_TEMPLATE)).toEqual({ start: '08:00', end: '08:45' })
    expect(nextSlot([row({ start: '08:00', end: '08:45' })], DEFAULT_TEMPLATE)).toEqual({ start: '08:55', end: '09:40' })
  })

  it('«Заполнить время» меняет только время: предметы и учителя прежних строк остаются', () => {
    const prev = [row({ subjectId: 'math', teacherId: 'u1', room: '12' }), row({ subjectId: 'art' })]
    const next = rowsFromTemplate({ ...DEFAULT_TEMPLATE, start: '09:00', count: 3 }, prev)
    expect(next).toHaveLength(3)
    expect(next[0]).toMatchObject({ start: '09:00', end: '09:45', subjectId: 'math', teacherId: 'u1', room: '12', key: prev[0].key })
    expect(next[1]).toMatchObject({ subjectId: 'art' })
    expect(next[2].subjectId).toBeUndefined()
  })
})

describe('проверка списка уроков', () => {
  it('пересечения находит независимо от порядка строк', () => {
    const rows = [row({ start: '09:00', end: '09:45' }), row({ start: '08:00', end: '08:45' }), row({ start: '09:30', end: '10:15' })]
    expect(findOverlap(rows)).toEqual([0, 2])
    expect(findOverlap([row(), row({ start: '08:45', end: '09:30' })])).toBeNull() // встык — не пересечение
  })

  it('понятные тексты ошибок', () => {
    expect(validateRows([], true)).toMatch(/хотя бы один урок/)
    expect(validateRows([row({ start: null })], true)).toBe('Урок 1: укажите время начала и конца')
    expect(validateRows([row({ start: '09:00', end: '08:00' })], true)).toMatch(/конец должен быть позже начала/)
    expect(validateRows([row({ subjectId: undefined })], true)).toBe('Урок 1: выберите предмет')
    expect(validateRows([row({ subjectId: undefined, activity: ' ' })], false)).toBe('Урок 1: укажите название')
    expect(validateRows([row(), row({ start: '08:30', end: '09:15' })], true)).toBe('Уроки 1 и 2 пересекаются по времени')
    expect(validateRows([row(), row({ start: '08:55', end: '09:40', subjectId: 'art' })], true)).toBeNull()
    expect(validateRows([row({ subjectId: undefined, activity: 'Прогулка' })], false)).toBeNull()
  })
})

describe('учитель по предмету и классу', () => {
  const t = (id: string, groupIds: string[], subjectIds: string[]): TeacherOption => ({ id, name: id, groupIds, subjectIds })
  const all = [t('a', ['g1'], ['math']), t('b', ['g1'], ['art', 'sport']), t('c', ['g1', 'g2'], ['sport']), t('d', ['g2'], ['math'])]

  it('подставляется, только если подходит ровно один', () => {
    expect(pickTeacher(all, 'g1', 'math')).toBe('a') // d ведёт другой класс
    expect(pickTeacher(all, 'g1', 'art')).toBe('b')
    expect(pickTeacher(all, 'g1', 'sport')).toBeUndefined() // b и c: решает человек
    expect(pickTeacher(all, 'g3', 'math')).toBeUndefined()
    expect(pickTeacher(all, undefined, 'math')).toBeUndefined()
    expect(pickTeacher(all, 'g1', undefined)).toBeUndefined()
  })

  it('в списке выбора подходящие учителя идут первыми', () => {
    expect(sortTeachers(all, 'g1', 'sport').map((x) => x.id)).toEqual(['b', 'c', 'a', 'd'])
  })
})

describe('запрос на сервер', () => {
  it('дни по порядку, пустые поля убираются, название — только у урока без предмета', () => {
    const payload = toPayload(
      'g1',
      [3, 1],
      [row({ teacherId: 'u1', room: ' 12 ' }), row({ subjectId: undefined, activity: ' Прогулка ', start: '09:00', end: '09:45', teacherId: '' })],
      true,
    )
    expect(payload).toEqual({
      groupId: 'g1',
      days: [1, 3],
      replace: true,
      lessons: [
        { startTime: '08:00', endTime: '08:45', subjectId: 'math', teacherId: 'u1', room: '12', activity: undefined },
        { startTime: '09:00', endTime: '09:45', subjectId: undefined, teacherId: undefined, room: undefined, activity: 'Прогулка' },
      ],
    })
  })
})
