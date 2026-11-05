import type { ConfigService } from '@nestjs/config'

import { extractStudentToken, makeStudentToken, parseStudentToken, verifyStudentToken } from './student-link'
import { StudentLinkService } from './student-link.service'

const SECRET = 'unit-test-secret-0123456789'
const USER = 'cmw1abc2d0000x1y2z3k4l5m6'

describe('личная ссылка: подпись и проверка', () => {
  it('токен имеет вид <id>.<22 символа base64url> и детерминирован', () => {
    const t = makeStudentToken(SECRET, USER, 1)
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/)
    expect(t.startsWith(USER + '.')).toBe(true)
    expect(makeStudentToken(SECRET, USER, 1)).toBe(t)
  })

  it('верная подпись для своей версии проходит', () => {
    expect(verifyStudentToken(SECRET, makeStudentToken(SECRET, USER, 1), 1)).toBe(true)
    expect(verifyStudentToken(SECRET, makeStudentToken(SECRET, USER, 7), 7)).toBe(true)
  })

  it('старая версия, новая версия и отозванный доступ (null/undefined) не проходят', () => {
    const v2 = makeStudentToken(SECRET, USER, 2)
    expect(verifyStudentToken(SECRET, v2, 3)).toBe(false) // после перевыпуска
    expect(verifyStudentToken(SECRET, v2, 1)).toBe(false)
    expect(verifyStudentToken(SECRET, v2, null)).toBe(false)
    expect(verifyStudentToken(SECRET, v2, undefined)).toBe(false)
  })

  it('другой секрет — ссылка не подходит', () => {
    expect(verifyStudentToken('another-secret-0123456789', makeStudentToken(SECRET, USER, 1), 1)).toBe(false)
  })

  it('подмена userId при чужой подписи и порча подписи не проходят', () => {
    const sig = makeStudentToken(SECRET, USER, 1).split('.')[1]
    expect(verifyStudentToken(SECRET, `cmw9other0000x1y2z3k4l5m6.${sig}`, 1)).toBe(false)

    const good = makeStudentToken(SECRET, USER, 1)
    const bad = good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A')
    expect(verifyStudentToken(SECRET, bad, 1)).toBe(false)
  })

  it('разные ученики и версии дают разные токены', () => {
    const tokens = new Set([
      makeStudentToken(SECRET, USER, 1),
      makeStudentToken(SECRET, USER, 2),
      makeStudentToken(SECRET, 'cmw9other0000x1y2z3k4l5m6', 1),
    ])
    expect(tokens.size).toBe(3)
  })

  it('кривой токен: пусто, нет точки, короткая или длинная подпись, лишние символы', () => {
    for (const bad of ['', 'abc', USER, `${USER}.`, `${USER}.short`, `${USER}.${'a'.repeat(23)}`, `${USER}.${'a'.repeat(21)}`, `${USER}!.${'a'.repeat(22)}`, `.${'a'.repeat(22)}`, `${USER}.${'a'.repeat(22)}.x`]) {
      expect(parseStudentToken(bad)).toBeNull()
      expect(verifyStudentToken(SECRET, bad, 1)).toBe(false)
    }
  })
})

describe('extractStudentToken (то, что вставляет человек)', () => {
  const token = makeStudentToken(SECRET, USER, 1)

  it('целая ссылка, со слэшем, с параметрами, в тексте и в окружении пробелов', () => {
    expect(extractStudentToken(`https://tahlilgar.cyou/s/${token}`)).toBe(token)
    expect(extractStudentToken(`  https://tahlilgar.cyou/s/${token}/ \n`)).toBe(token)
    expect(extractStudentToken(`https://tahlilgar.cyou/s/${token}?utm=1#x`)).toBe(token)
    expect(extractStudentToken(`Ваша ссылка: https://tahlilgar.cyou/s/${token} — не показывайте её`)).toBe(token)
    expect(extractStudentToken(`http://127.0.0.1:5173/s/${token}`)).toBe(token)
  })

  it('только токен', () => {
    expect(extractStudentToken(token)).toBe(token)
    expect(extractStudentToken(`\n ${token} \n`)).toBe(token)
  })

  it('мусор и ссылки не на /s/ — null', () => {
    for (const bad of ['', '   ', 'привет', 'https://tahlilgar.cyou/login', `https://tahlilgar.cyou/set-password?token=${token}`, 'https://tahlilgar.cyou/s/short']) {
      expect(extractStudentToken(bad)).toBeNull()
    }
  })
})

describe('StudentLinkService', () => {
  const make = (cfg: Record<string, unknown>) => new StudentLinkService({ get: (k: string) => cfg[k] } as unknown as ConfigService)

  it('ссылка = APP_URL/s/<токен>; адрес по умолчанию — tahlilgar.cyou', () => {
    const s = make({ 'jwt.studentLinkSecret': SECRET, 'mail.appUrl': 'https://school.example' })
    expect(s.link(USER, 1)).toBe(`https://school.example/s/${makeStudentToken(SECRET, USER, 1)}`)
    expect(make({ 'jwt.studentLinkSecret': SECRET }).link(USER, 1)).toMatch(/^https:\/\/tahlilgar\.cyou\/s\//)
  })

  it('своего секрета нет — берётся производный от refresh-секрета; свой секрет приоритетнее', () => {
    const fallback = make({ 'jwt.refreshSecret': 'refresh-secret-0123456789' })
    expect(fallback.token(USER, 1)).toBe(makeStudentToken('refresh-secret-0123456789:student-link', USER, 1))

    const explicit = make({ 'jwt.studentLinkSecret': SECRET, 'jwt.refreshSecret': 'refresh-secret-0123456789' })
    expect(explicit.token(USER, 1)).toBe(makeStudentToken(SECRET, USER, 1))
  })

  it('смена секрета гасит выданные ссылки', () => {
    const before = make({ 'jwt.studentLinkSecret': SECRET })
    const after = make({ 'jwt.studentLinkSecret': 'rotated-secret-0123456789' })
    const token = before.token(USER, 1)

    expect(before.verify(token, 1)).toBe(true)
    expect(after.verify(token, 1)).toBe(false)
  })

  it('parse/verify проксируют чистые функции', () => {
    const s = make({ 'jwt.studentLinkSecret': SECRET })
    const token = s.token(USER, 4)
    expect(s.parse(token)).toMatchObject({ userId: USER })
    expect(s.verify(token, 4)).toBe(true)
    expect(s.verify(token, 5)).toBe(false)
  })
})
