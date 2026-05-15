import { describe, it, expect } from 'vitest'
import {
  toBackendPosition,
  toRussianPosition,
  POSITION_TO_ENUM,
  ENUM_TO_POSITION,
} from './positionMap'

describe('positionMap', () => {
  it('маппинг русский → enum', () => {
    expect(toBackendPosition('Заведующий')).toBe('HEAD_MASTER')
    expect(toBackendPosition('Медсестра')).toBe('NURSE')
    expect(toBackendPosition('Повар')).toBe('COOK')
    expect(toBackendPosition('Помощник воспитателя')).toBe('TEACHER_ASSISTANT')
  })

  it('неизвестная должность → OTHER', () => {
    expect(toBackendPosition('Неизвестная должность')).toBe('OTHER')
    // 'Воспитатель' создаётся через Teachers, не Staff — здесь это OTHER
    expect(toBackendPosition('Воспитатель')).toBe('OTHER')
  })

  it('маппинг enum → русский', () => {
    expect(toRussianPosition('HEAD_MASTER')).toBe('Заведующий')
    expect(toRussianPosition('NURSE')).toBe('Медсестра')
    expect(toRussianPosition('OTHER')).toBe('Прочее')
  })

  it('round-trip: RU → enum → RU', () => {
    Object.keys(POSITION_TO_ENUM).forEach((ru) => {
      const enumVal = toBackendPosition(ru)
      expect(toRussianPosition(enumVal)).toBe(ru)
    })
  })

  it('round-trip: enum → RU → enum (кроме OTHER)', () => {
    Object.keys(ENUM_TO_POSITION).forEach((en) => {
      const ru = toRussianPosition(en)
      if (en !== 'OTHER') {
        expect(toBackendPosition(ru)).toBe(en)
      }
    })
  })
})
