import { describe, it, expect } from 'vitest'
import { hasFeature } from './features'
import type { User } from '../types'

const user = (patch: Partial<User>): User => ({
  id: 'u1',
  fullName: 'A',
  email: 'a@b.c',
  role: 'ADMIN',
  kindergartenId: 'k1',
  ...patch,
})

describe('hasFeature', () => {
  it('нет пользователя — нет доступа', () => {
    expect(hasFeature(null, 'chat')).toBe(false)
    expect(hasFeature(undefined, 'chat')).toBe(false)
  })

  it('владелец платформы (без учреждения) видит все разделы', () => {
    expect(hasFeature(user({ kindergartenId: null, features: [] }), 'payments')).toBe(true)
  })

  it('список ещё не загружен (старая сессия) — не прячем, бэкенд закроет сам', () => {
    expect(hasFeature(user({ features: undefined }), 'payments')).toBe(true)
  })

  it('раздел из списка включён, отсутствующий — выключен', () => {
    const u = user({ features: ['chat', 'grades'] })
    expect(hasFeature(u, 'chat')).toBe(true)
    expect(hasFeature(u, 'payments')).toBe(false)
  })

  it('пустой список выключает всё (в отличие от undefined)', () => {
    expect(hasFeature(user({ features: [] }), 'chat')).toBe(false)
  })
})
