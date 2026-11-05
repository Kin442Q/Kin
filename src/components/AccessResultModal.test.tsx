import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react'
import { App as AntdApp } from 'antd'

import AccessResultModal, { mailFailureText } from './AccessResultModal'
import type { AccessGrant } from '../api/accessApi'

// antd-окна в jsdom рисуются небыстро
vi.setConfig({ testTimeout: 20_000 })
configure({ asyncUtilTimeout: 8_000 })

function renderModal(grant: AccessGrant | null, onRetry?: () => Promise<AccessGrant>) {
  return render(
    <AntdApp>
      <AccessResultModal grant={grant} onRetry={onRetry} onClose={() => {}} />
    </AntdApp>,
  )
}

describe('AccessResultModal', () => {
  it('письмо ушло: адрес и объяснение «сам придумает пароль», никакого пароля', async () => {
    renderModal({ sent: true, email: 'maria@school.tj' })

    expect(await screen.findByText('Письмо ушло на maria@school.tj')).toBeInTheDocument()
    expect(screen.getByText(/сам придумает пароль/)).toBeInTheDocument()
    expect(screen.queryByText(/Временный пароль/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Печать|Скопировать/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Готово' })).toBeInTheDocument()
  })

  it('письмо не ушло: причина понятными словами и никакого пароля', async () => {
    renderModal({ sent: false, email: 'maria@school.tj', reason: 'NOT_CONFIGURED' }, vi.fn())

    expect(await screen.findByText('Письмо на maria@school.tj не ушло')).toBeInTheDocument()
    expect(screen.getByText(/Почта на сервере ещё не настроена/)).toBeInTheDocument()
    expect(screen.getByText(/Пароль никому не передаётся/)).toBeInTheDocument()
    expect(screen.queryByText(/Временный пароль|Пароль виден только сейчас/)).not.toBeInTheDocument()
  })

  it('«Отправить приглашение ещё раз» шлёт повторно и показывает новый итог', async () => {
    const onRetry = vi.fn().mockResolvedValue({ sent: true, email: 'maria@school.tj' } satisfies AccessGrant)
    renderModal({ sent: false, email: 'maria@school.tj', reason: 'NETWORK' }, onRetry)

    fireEvent.click(await screen.findByRole('button', { name: /Отправить приглашение ещё раз/ }))

    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Письмо ушло на maria@school.tj')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Отправить приглашение ещё раз/ })).not.toBeInTheDocument()
  })

  it('без onRetry кнопки повторной отправки нет', async () => {
    renderModal({ sent: false, email: 'maria@school.tj', reason: 'NETWORK' })

    expect(await screen.findByText('Письмо на maria@school.tj не ушло')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Отправить приглашение ещё раз/ })).not.toBeInTheDocument()
  })

  it('окно закрыто (grant = null) — ничего не показывает', () => {
    renderModal(null)
    expect(screen.queryByText(/Приглашение отправлено|Письмо не отправлено/)).not.toBeInTheDocument()
  })
})

describe('mailFailureText', () => {
  it('три причины — три разных фразы; сообщение провайдера и подсказка про домен', () => {
    expect(mailFailureText('NOT_CONFIGURED')).toMatch(/ещё не настроена/)
    expect(mailFailureText('NETWORK')).toMatch(/связаться с почтовым сервисом/)
    const rejected = mailFailureText('REJECTED', 'The domain is not verified.')
    expect(rejected).toContain('The domain is not verified')
    expect(rejected).not.toContain('..')
    expect(rejected).toMatch(/домен отправителя подтверждён/)
  })
})
