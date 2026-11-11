import { BadRequestException, Controller, Get, INestApplication, InternalServerErrorException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Prisma } from '@prisma/client'

import { registerExceptionFilters } from '../../common/filters/register-filters'
import type { AlertEvent } from './alert-event'

class HttpFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

@Controller('boom')
class BoomController {
  @Get('type-error')
  typeError() {
    return (undefined as unknown as { x: { y: number } }).x.y
  }

  @Get('http-500')
  http500() {
    throw new InternalServerErrorException('сломалось')
  }

  @Get('http-400')
  http400() {
    throw new BadRequestException('плохой запрос')
  }

  @Get('prisma-missing-column')
  prismaMissingColumn() {
    throw new Prisma.PrismaClientKnownRequestError('The column `User.foo` does not exist', {
      code: 'P2022',
      clientVersion: 'test',
    })
  }

  @Get('prisma-unique')
  prismaUnique() {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
  }

  @Get('client-error/:code')
  clientError() {
    throw new HttpFailure('Слишком большой запрос', 413)
  }
}

describe('глобальные фильтры ошибок (как в main.ts)', () => {
  let app: INestApplication
  let events: AlertEvent[]
  let base: string

  const get = async (path: string) => {
    const res = await fetch(base + path)
    return { status: res.status, body: (await res.json()) as Record<string, unknown> }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [BoomController] }).compile()
    app = moduleRef.createNestApplication()
    events = []
    registerExceptionFilters(app, { report: (e) => void events.push(e) })
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
    // Nest сам пишет ошибки в лог — в тестах он не нужен.
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterAll(async () => {
    await app.close()
    jest.restoreAllMocks()
  })
  beforeEach(() => {
    events.length = 0
  })

  it('неожиданная ошибка в коде: аккуратный 500 без деталей и оповещение', async () => {
    const res = await get('/boom/type-error?token=secret')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ statusCode: 500, message: 'Внутренняя ошибка сервера' })
    expect(JSON.stringify(res.body)).not.toContain('undefined')
    expect(JSON.stringify(res.body)).not.toContain('secret')

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ source: 'http', status: 500, method: 'GET', route: '/boom/type-error' })
    expect(events[0].error).toBeInstanceOf(TypeError)
  })

  it('HttpException 5xx сохраняет свой ответ и тоже оповещает', async () => {
    const res = await get('/boom/http-500')
    expect(res.status).toBe(500)
    expect(res.body.message).toBe('сломалось')
    expect(events).toHaveLength(1)
    expect(events[0].status).toBe(500)
  })

  it('ошибки пользователя (4xx) не оповещают', async () => {
    const res = await get('/boom/http-400')
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('плохой запрос')
    expect((await get('/boom/no-such-route')).status).toBe(404)
    expect(events).toHaveLength(0)
  })

  it('Prisma: известные коды остаются прежними и не оповещают', async () => {
    const res = await get('/boom/prisma-unique')
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('P2002')
    expect(events).toHaveLength(0)
  })

  it('Prisma: неизвестный код (миграция не применена) отдаётся как раньше, но оповещает', async () => {
    const res = await get('/boom/prisma-missing-column')
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ code: 'P2022', message: 'Ошибка базы данных' })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ route: '/boom/prisma-missing-column', status: 400, label: 'Ошибка базы данных' })
  })

  it('ошибка с кодом 4xx от промежуточного слоя возвращается как есть и не считается поломкой', async () => {
    const res = await get('/boom/client-error/1')
    expect(res.status).toBe(413)
    expect(res.body).toMatchObject({ statusCode: 413, message: 'Слишком большой запрос' })
    expect(events).toHaveLength(0)
  })
})
