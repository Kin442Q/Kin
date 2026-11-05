import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

import { MailService } from './mail.service'

const API_KEY = 're_test_key_do_not_log'
const MESSAGE = { to: 'director@school.tj', subject: 'Тема', html: '<p>Привет</p>', text: 'Привет' }

describe('MailService', () => {
  let cfg: Record<string, unknown>
  let fetchMock: jest.Mock
  let warn: jest.SpyInstance
  const realFetch = global.fetch

  const make = () => new MailService({ get: (k: string) => cfg[k] } as unknown as ConfigService)
  const json = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

  beforeEach(() => {
    cfg = { 'mail.resendApiKey': API_KEY, 'mail.apiUrl': 'https://mail.test/emails', 'mail.from': 'Мактаби ман <no-reply@x.tj>' }
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    global.fetch = realFetch
    warn.mockRestore()
    jest.useRealTimers()
  })

  it('без ключа отправка выключена: сеть не трогаем', async () => {
    cfg['mail.resendApiKey'] = undefined
    const mail = make()

    expect(mail.isConfigured()).toBe(false)
    await expect(mail.send(MESSAGE)).resolves.toEqual({ sent: false, reason: 'NOT_CONFIGURED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('успех: POST с Bearer-ключом и телом {from, to[], subject, html, text}', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 'msg_123' }))
    const mail = make()

    expect(mail.isConfigured()).toBe(true)
    await expect(mail.send(MESSAGE)).resolves.toEqual({ sent: true, id: 'msg_123' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://mail.test/emails')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`)
    expect(JSON.parse(init.body)).toEqual({
      from: 'Мактаби ман <no-reply@x.tj>',
      to: ['director@school.tj'],
      subject: 'Тема',
      html: '<p>Привет</p>',
      text: 'Привет',
    })
  })

  it('адрес API и отправитель по умолчанию — Resend и no-reply@tahlilgar.cyou', async () => {
    cfg = { 'mail.resendApiKey': API_KEY }
    fetchMock.mockResolvedValue(json(200, {}))

    await expect(make().send(MESSAGE)).resolves.toEqual({ sent: true, id: undefined })

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('Мактаби ман <no-reply@tahlilgar.cyou>')
  })

  it('ошибка провайдера (4xx): REJECTED с сообщением, без исключения', async () => {
    fetchMock.mockResolvedValue(json(403, { name: 'validation_error', message: 'The tahlilgar.cyou domain is not verified.' }))

    await expect(make().send(MESSAGE)).resolves.toEqual({
      sent: false,
      reason: 'REJECTED',
      detail: 'The tahlilgar.cyou domain is not verified.',
    })
  })

  it('5xx с не-JSON телом: REJECTED без сообщения', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('not json') } } as unknown as Response)

    await expect(make().send(MESSAGE)).resolves.toEqual({ sent: false, reason: 'REJECTED', detail: undefined })
  })

  it('сеть недоступна: NETWORK, без исключения', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(make().send(MESSAGE)).resolves.toEqual({ sent: false, reason: 'NETWORK' })
  })

  it('зависший запрос обрывается через 10 секунд: NETWORK', async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        }),
    )

    const pending = make().send(MESSAGE)
    await jest.advanceTimersByTimeAsync(10_000)

    await expect(pending).resolves.toEqual({ sent: false, reason: 'NETWORK' })
  })

  it('в логах нет ни ключа, ни текста письма, ни ссылки', async () => {
    fetchMock.mockResolvedValue(json(422, { message: 'Invalid `to` field' }))
    await make().send({ ...MESSAGE, text: 'секретная ссылка https://x.test/set-password?token=SECRET', html: 'SECRET' })
    fetchMock.mockRejectedValue(new Error(`boom ${API_KEY}`))
    await make().send(MESSAGE)

    const logged = JSON.stringify(warn.mock.calls)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(logged).not.toContain(API_KEY)
    expect(logged).not.toContain('SECRET')
    expect(logged).not.toContain('director@school.tj')
  })
})
