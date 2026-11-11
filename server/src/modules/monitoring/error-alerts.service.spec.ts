import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

import type { MailService } from '../mail/mail.service'
import { DEDUPE_MS, ErrorAlertsService, MAX_ALERTS_PER_HOUR } from './error-alerts.service'

describe('ErrorAlertsService', () => {
  let emails: string[]
  let send: jest.Mock
  let warn: jest.SpyInstance

  const make = () =>
    new ErrorAlertsService(
      { get: (k: string) => (k === 'alerts.emails' ? emails : undefined) } as unknown as ConfigService,
      { send } as unknown as MailService,
    )
  const http500 = (route = '/api/v1/students/:id', error: unknown = new TypeError('x is undefined')) => ({
    source: 'http' as const,
    status: 500,
    method: 'GET',
    route,
    userId: 'u1',
    role: 'TEACHER',
    error,
  })

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-06T10:00:00Z'))
    emails = ['owner@gmail.com']
    send = jest.fn().mockResolvedValue({ sent: true })
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.useRealTimers()
    warn.mockRestore()
  })

  it('без ALERT_EMAIL ничего не отправляет', () => {
    emails = []
    make().report(http500())
    expect(send).not.toHaveBeenCalled()
  })

  it('игнорирует некорректные адреса и шлёт на корректные', () => {
    emails = ['не-почта', 'a@b.tj']
    make().report(http500())
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].to).toBe('a@b.tj')
  })

  it('письмо содержит место, ошибку и пользователя, но не лишнее', () => {
    make().report(http500('/api/v1/students/:id', new TypeError('нет поля, ответ для anna@school.tj')))
    const msg = send.mock.calls[0][0]
    expect(msg.subject).toContain('Ошибка 500')
    expect(msg.subject).toContain('GET /api/v1/students/:id')
    expect(msg.text).toContain('GET /api/v1/students/:id → HTTP 500')
    expect(msg.text).toContain('TypeError')
    expect(msg.text).toContain('роль TEACHER')
    expect(msg.text).not.toContain('anna@school.tj')
    expect(msg.html).toContain('<pre')
  })

  it('для ошибки базы в теме стоит её название, а не код ответа', () => {
    make().report({ ...http500('/api/v1/kindergartens'), status: 400, label: 'Ошибка базы данных' })
    expect(send.mock.calls[0][0].subject).toBe('[Мактаби ман] Ошибка базы данных: GET /api/v1/kindergartens')
  })

  it('экранирует html в письме', () => {
    make().report(http500('/x', new Error('<script>alert(1)</script>')))
    expect(send.mock.calls[0][0].html).not.toContain('<script>')
    expect(send.mock.calls[0][0].html).toContain('&lt;script&gt;')
  })

  it('одну и ту же ошибку не шлёт чаще раза в 15 минут и потом сообщает число повторов', () => {
    const alerts = make()
    const err = new TypeError('одна и та же')
    alerts.report(http500('/a', err))
    alerts.report(http500('/a', err))
    alerts.report(http500('/a', err))
    expect(send).toHaveBeenCalledTimes(1)

    jest.setSystemTime(Date.now() + DEDUPE_MS + 1000)
    alerts.report(http500('/a', err))
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0].text).toContain('Повторилась ещё 2 раз')
  })

  it('разные маршруты и разные ошибки — разные письма', () => {
    const alerts = make()
    alerts.report(http500('/a', new TypeError('a')))
    alerts.report(http500('/b', new TypeError('a')))
    alerts.report({ ...http500('/a', new RangeError('r')) })
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('не больше MAX_ALERTS_PER_HOUR писем в час, пропущенное отмечено в следующем', () => {
    const alerts = make()
    for (let i = 0; i < MAX_ALERTS_PER_HOUR + 5; i++) alerts.report(http500(`/r${i}`))
    expect(send).toHaveBeenCalledTimes(MAX_ALERTS_PER_HOUR)

    jest.setSystemTime(Date.now() + 61 * 60_000)
    alerts.report(http500('/after'))
    expect(send).toHaveBeenCalledTimes(MAX_ALERTS_PER_HOUR + 1)
    expect(send.mock.calls[MAX_ALERTS_PER_HOUR][0].text).toContain('пропущено других оповещений: 5')
  })

  it('не бросает исключений, даже если почта упала', async () => {
    send.mockRejectedValue(new Error('network down'))
    const alerts = make()
    expect(() => alerts.report(http500())).not.toThrow()
    await expect(alerts.flush(50)).resolves.toBeUndefined()
  })

  it('сообщает в лог, если письмо не доставлено', async () => {
    send.mockResolvedValue({ sent: false, reason: 'REJECTED' })
    const alerts = make()
    alerts.report(http500())
    await alerts.flush(50)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('не доставлено'))
  })

  it('flush ждёт отправку, но не дольше таймаута', async () => {
    let release!: () => void
    send.mockReturnValue(new Promise((r) => (release = () => r({ sent: true }))))
    const alerts = make()
    alerts.report(http500())

    const flushed = alerts.flush(3000)
    jest.advanceTimersByTime(3000)
    await expect(flushed).resolves.toBeUndefined()
    release()
  })

  describe('sendTest (кнопка «Проверить оповещения»)', () => {
    let configured: boolean
    const makeWithMail = () =>
      new ErrorAlertsService(
        { get: (k: string) => (k === 'alerts.emails' ? emails : undefined) } as unknown as ConfigService,
        { send, isConfigured: () => configured } as unknown as MailService,
      )
    beforeEach(() => {
      configured = true
    })

    it('без ALERT_EMAIL объясняет, чего не хватает, и ничего не шлёт', async () => {
      emails = []
      await expect(makeWithMail().sendTest()).resolves.toEqual({ ok: false, reason: 'NO_RECIPIENTS', recipients: 0 })
      expect(send).not.toHaveBeenCalled()
    })

    it('без ключа почты говорит об этом', async () => {
      configured = false
      await expect(makeWithMail().sendTest()).resolves.toMatchObject({ ok: false, reason: 'MAIL_NOT_CONFIGURED' })
      expect(send).not.toHaveBeenCalled()
    })

    it('шлёт проверочное письмо каждому адресу, даже сразу несколько раз подряд (без дедупликации)', async () => {
      emails = ['a@b.tj', 'c@d.tj']
      const alerts = makeWithMail()
      await expect(alerts.sendTest()).resolves.toEqual({ ok: true, recipients: 2 })
      await expect(alerts.sendTest()).resolves.toEqual({ ok: true, recipients: 2 })
      expect(send).toHaveBeenCalledTimes(4)
      expect(send.mock.calls[0][0].subject).toContain('Проверка оповещений')
    })

    it('если провайдер отказал, возвращает причину и его сообщение', async () => {
      send.mockResolvedValue({ sent: false, reason: 'REJECTED', detail: 'The tahlilgar.cyou domain is not verified.' })
      await expect(makeWithMail().sendTest()).resolves.toEqual({
        ok: false,
        reason: 'MAIL_REJECTED',
        recipients: 1,
        detail: 'The tahlilgar.cyou domain is not verified.',
      })
    })

    it('если нет сети до провайдера, сообщает об этом', async () => {
      send.mockResolvedValue({ sent: false, reason: 'NETWORK' })
      await expect(makeWithMail().sendTest()).resolves.toMatchObject({ ok: false, reason: 'MAIL_NETWORK' })
    })
  })

  it('необработанная ошибка вне запроса описывается без маршрута', () => {
    make().report({ source: 'process', error: new Error('фоновая задача') })
    const msg = send.mock.calls[0][0]
    expect(msg.text).toContain('вне запроса')
    expect(msg.subject).toContain('Ошибка')
  })
})
