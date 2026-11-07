import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

vi.mock('../api/monitoringApi', () => ({ monitoringApi: { testAlert: vi.fn() } }))

import { monitoringApi } from '../api/monitoringApi'
import AlertsCheckButton, { describeAlertTest } from './AlertsCheckButton'

vi.setConfig({ testTimeout: 20_000 })
configure({ asyncUtilTimeout: 8_000 })

const api = vi.mocked(monitoringApi)

function renderButton() {
  return render(
    <AntdApp>
      <AlertsCheckButton />
    </AntdApp>,
  )
}

describe('AlertsCheckButton — проверка оповещений об ошибках', () => {
  beforeEach(() => {
    api.testAlert.mockReset()
  })

  it('письмо ушло: владелец видит, что искать в почте', async () => {
    api.testAlert.mockResolvedValue({ ok: true, recipients: 2 })
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: /Проверить оповещения/ }))

    expect(await screen.findByText(/Проверочное письмо отправлено \(адресов: 2\)/)).toBeInTheDocument()
    expect(api.testAlert).toHaveBeenCalledTimes(1)
  })

  it('ALERT_EMAIL не задан: сказано, что именно вписать в Railway', async () => {
    api.testAlert.mockResolvedValue({ ok: false, reason: 'NO_RECIPIENTS', recipients: 0 })
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: /Проверить оповещения/ }))

    expect(await screen.findByText(/не задана переменная ALERT_EMAIL/)).toBeInTheDocument()
  })

  it('сервер не ответил: понятная ошибка вместо падения', async () => {
    api.testAlert.mockRejectedValue(new Error('Network Error'))
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: /Проверить оповещения/ }))

    expect(await screen.findByText(/сервер не ответил/)).toBeInTheDocument()
  })
})

describe('describeAlertTest', () => {
  it('для каждой причины даёт отдельное понятное объяснение', () => {
    expect(describeAlertTest({ ok: false, reason: 'MAIL_NOT_CONFIGURED', recipients: 1 }).text).toContain('RESEND_API_KEY')
    expect(describeAlertTest({ ok: false, reason: 'MAIL_REJECTED', recipients: 1, detail: 'domain is not verified' }).text).toContain(
      'domain is not verified',
    )
    expect(describeAlertTest({ ok: false, reason: 'MAIL_NETWORK', recipients: 1 }).text).toContain('связаться')
    expect(describeAlertTest({ ok: true, recipients: 1 }).ok).toBe(true)
  })
})
