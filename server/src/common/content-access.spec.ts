import { ForbiddenException } from '@nestjs/common'

import { assertCanManage, assertSameSchool, isAdminRole, requireSchool } from './content-access'
import type { AuthUser } from './types/jwt-payload'

const user = (patch: Partial<AuthUser>): AuthUser => ({
  sub: 'u1',
  email: 'u@s.tj',
  role: 'TEACHER',
  kindergartenId: 'k1',
  groupId: null,
  childId: null,
  ...patch,
})

describe('content-access', () => {
  it('requireSchool: возвращает школу, владельцу платформы — 403', () => {
    expect(requireSchool(user({}))).toBe('k1')
    expect(() => requireSchool(user({ kindergartenId: null, role: 'SUPER_ADMIN' }))).toThrow(ForbiddenException)
  })

  it('assertSameSchool: своя школа — ок, чужая — 403, владелец видит всё', () => {
    expect(() => assertSameSchool(user({}), 'k1')).not.toThrow()
    expect(() => assertSameSchool(user({}), 'k2')).toThrow(ForbiddenException)
    expect(() => assertSameSchool(user({ kindergartenId: null }), 'k2')).not.toThrow()
  })

  it('isAdminRole', () => {
    expect(isAdminRole(user({ role: 'ADMIN' }))).toBe(true)
    expect(isAdminRole(user({ role: 'SUPER_ADMIN' }))).toBe(true)
    expect(isAdminRole(user({ role: 'TEACHER' }))).toBe(false)
  })

  describe('assertCanManage', () => {
    const mine = { authorId: 'u1', kindergartenId: 'k1' }
    const others = { authorId: 'u2', kindergartenId: 'k1' }

    it('автор-учитель правит своё', () => {
      expect(() => assertCanManage(user({}), mine)).not.toThrow()
    })

    it('учитель не правит чужое', () => {
      expect(() => assertCanManage(user({}), others)).toThrow(ForbiddenException)
    })

    it('учитель не правит материал без автора (автора удалили) — это дело админа', () => {
      expect(() => assertCanManage(user({}), { authorId: null, kindergartenId: 'k1' })).toThrow(ForbiddenException)
    })

    it('админ школы правит любое в своей школе', () => {
      expect(() => assertCanManage(user({ role: 'ADMIN', sub: 'a' }), others)).not.toThrow()
      expect(() => assertCanManage(user({ role: 'SUPER_ADMIN', sub: 'a' }), { authorId: null, kindergartenId: 'k1' })).not.toThrow()
    })

    it('админ другой школы — 403', () => {
      expect(() => assertCanManage(user({ role: 'ADMIN', kindergartenId: 'k2' }), others)).toThrow(ForbiddenException)
    })

    it('ученик и родитель не правят ничего, даже «своё»', () => {
      expect(() => assertCanManage(user({ role: 'STUDENT' }), mine)).toThrow(ForbiddenException)
      expect(() => assertCanManage(user({ role: 'PARENT' }), mine)).toThrow(ForbiddenException)
    })
  })
})
