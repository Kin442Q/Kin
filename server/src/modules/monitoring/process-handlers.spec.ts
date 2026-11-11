import { EventEmitter } from 'node:events'
import { Logger } from '@nestjs/common'

import { installProcessHandlers } from './process-handlers'

describe('installProcessHandlers', () => {
  let proc: EventEmitter & { exit: jest.Mock }
  let alerts: { report: jest.Mock; flush: jest.Mock }
  let logError: jest.SpyInstance

  beforeEach(() => {
    proc = Object.assign(new EventEmitter(), { exit: jest.fn() })
    alerts = { report: jest.fn(), flush: jest.fn().mockResolvedValue(undefined) }
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    installProcessHandlers(alerts, proc as unknown as NodeJS.Process)
  })
  afterEach(() => logError.mockRestore())

  it('необработанный reject: лог и оповещение, процесс продолжает работать', () => {
    const reason = new Error('забытый await')
    proc.emit('unhandledRejection', reason)

    expect(alerts.report).toHaveBeenCalledWith({ source: 'process', error: reason })
    expect(logError).toHaveBeenCalled()
    expect(proc.exit).not.toHaveBeenCalled()
  })

  it('uncaughtException: оповещение, ожидание отправки письма и выход с кодом 1', async () => {
    const error = new Error('фатально')
    proc.emit('uncaughtException', error)

    expect(alerts.report).toHaveBeenCalledWith({ source: 'process', error })
    expect(alerts.flush).toHaveBeenCalledWith(3000)
    await Promise.resolve()
    await Promise.resolve()
    expect(proc.exit).toHaveBeenCalledWith(1)
  })
})
