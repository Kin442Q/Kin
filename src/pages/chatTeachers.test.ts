import { describe, it, expect } from 'vitest'
import { pickTeacherId, teacherOptionText } from './chatTeachers'

const t = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  fullName: `Учитель ${id}`,
  isHomeroom: false,
  subjects: [] as string[],
  lastMessageAt: null,
  unread: false,
  ...extra,
})

describe('pickTeacherId — с кем открыть чат родителя', () => {
  const list = { defaultTeacherId: 'b', teachers: [t('a'), t('b'), t('c')] }

  it('без выбора берёт того, кого предложил сервер', () => {
    expect(pickTeacherId(list)).toBe('b')
  })

  it('выбранный учитель остаётся выбранным, если он есть в списке', () => {
    expect(pickTeacherId(list, 'c')).toBe('c')
  })

  it('выбранного больше нет в классе — возвращаемся к предложенному сервером', () => {
    expect(pickTeacherId(list, 'gone')).toBe('b')
  })

  it('сервер ничего не предложил — первый в списке', () => {
    expect(pickTeacherId({ defaultTeacherId: null, teachers: [t('a'), t('b')] })).toBe('a')
  })

  it('предложенный сервером отсутствует в списке — первый в списке', () => {
    expect(pickTeacherId({ defaultTeacherId: 'zzz', teachers: [t('a')] })).toBe('a')
  })

  it('пустой или отсутствующий список — null, без ошибок', () => {
    expect(pickTeacherId({ defaultTeacherId: null, teachers: [] })).toBeNull()
    expect(pickTeacherId({ defaultTeacherId: 'a', teachers: [] }, 'a')).toBeNull()
    expect(pickTeacherId(null)).toBeNull()
    expect(pickTeacherId(undefined, 'a')).toBeNull()
  })
})

describe('teacherOptionText — подпись учителя в выборе', () => {
  it('только имя, если нет ни предметов, ни должности', () => {
    expect(teacherOptionText(t('a'), 'Классный руководитель')).toBe('Учитель a')
  })

  it('классному руководителю добавляется отметка, предметы — через запятую', () => {
    expect(
      teacherOptionText(t('a', { isHomeroom: true, subjects: ['Физика', 'Химия'] }), 'Классный руководитель'),
    ).toBe('Учитель a — Классный руководитель · Физика, Химия')
  })

  it('только предметы', () => {
    expect(teacherOptionText(t('a', { subjects: ['Математика'] }), 'Классный руководитель')).toBe(
      'Учитель a — Математика',
    )
  })
})
