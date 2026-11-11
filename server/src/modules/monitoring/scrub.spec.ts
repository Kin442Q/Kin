import { BadRequestException, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common'

import { describeError } from './alert-event'
import { scrubPath, scrubText } from './scrub'

describe('scrubText', () => {
  it('прячет почту, JWT и длинные токены', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlMTIzNDU2'
    const out = scrubText(`Не нашли teacher@school.tj; токен ${jwt}; ссылка t9k2m4x8q1w7z5v3b6n0c4m8x2 ok`)
    expect(out).not.toContain('teacher@school.tj')
    expect(out).not.toContain('eyJ')
    expect(out).not.toContain('t9k2m4x8q1w7z5v3b6n0c4m8x2')
    expect(out).toContain('[email]')
    expect(out).toContain('[jwt]')
    expect(out).toContain('[token]')
    expect(out).toContain('ok')
  })

  it('длинные имена из кода без цифр не трогает', () => {
    expect(scrubText('ClassSerializerInterceptor упал')).toBe('ClassSerializerInterceptor упал')
  })

  it('обрезает слишком длинный текст', () => {
    const out = scrubText('а'.repeat(900), 100)
    expect(out.length).toBe(101)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('scrubPath', () => {
  it('убирает query и заменяет идентификаторы', () => {
    expect(scrubPath('/api/v1/students/42/grades?token=secret&x=1')).toBe('/api/v1/students/:n/grades')
    expect(scrubPath('/api/v1/auth/password-token/Zk3p9Qw7Lm2Xv8Rt4Yb6Nc1Hd5Fg0Js')).toBe('/api/v1/auth/password-token/:id')
    expect(scrubPath('/api/v1/groups/3f2b7c1e-9a44-4d1b-8e3a-0c5d6e7f8a9b/lessons')).toBe('/api/v1/groups/:id/lessons')
    expect(scrubPath('/api/v1/health/readiness')).toBe('/api/v1/health/readiness')
  })
})

describe('describeError', () => {
  it('у ошибок Prisma оставляет только последнюю строку сообщения (без значений запроса)', () => {
    class PrismaClientKnownRequestError extends Error {
      code = 'P2022'
    }
    const e = new PrismaClientKnownRequestError(
      'Invalid `prisma.user.findFirst()` invocation:\n\n{ where: { email: "anna@school.tj" } }\n\nThe column `User.foo` does not exist in the current database.',
    )
    e.name = 'PrismaClientKnownRequestError'
    const d = describeError(e)
    expect(d.code).toBe('P2022')
    expect(d.message).toBe('The column `User.foo` does not exist in the current database.')
    expect(d.message).not.toContain('anna@school.tj')
  })

  it('у HttpException берёт суть из тела ответа (например, что именно не готово у проверки готовности)', () => {
    const terminus = new ServiceUnavailableException({
      status: 'error',
      info: { db: { status: 'up' } },
      error: { redis: { status: 'down' } },
    })
    expect(describeError(terminus).message).toBe('Service Unavailable Exception: {"redis":{"status":"down"}}')
    expect(describeError(new BadRequestException(['а неверно', 'б неверно'])).message).toBe('а неверно, б неверно')
    expect(describeError(new InternalServerErrorException('сломалось')).message).toBe('сломалось')
  })

  it('берёт начало стека и понимает не-Error значения', () => {
    const d = describeError(new TypeError('boom'))
    expect(d.name).toBe('TypeError')
    expect(d.stack.length).toBeGreaterThan(0)
    expect(d.stack.every((l) => l.startsWith('at '))).toBe(true)
    expect(describeError('просто строка')).toMatchObject({ name: 'NonError', message: '"просто строка"'.replace(/"/g, '') })
    expect(describeError({ a: 1 }).message).toBe('{"a":1}')
  })
})
