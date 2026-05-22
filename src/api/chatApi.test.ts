import { describe, it, expect, vi, beforeEach } from 'vitest'

// Мокаем http-слой — проверяем, что chatApi дёргает правильные эндпоинты
// и передаёт scope/payload по контракту бэкенда.
const get = vi.fn()
const post = vi.fn()
vi.mock('./http', () => ({
  http: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}))

import { chatApi } from './chatApi'

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  get.mockResolvedValue({ data: {} })
  post.mockResolvedValue({ data: {} })
})

describe('chatApi.my (родитель)', () => {
  it('по умолчанию запрашивает канал GENERAL', async () => {
    await chatApi.my()
    expect(get).toHaveBeenCalledWith('/v1/chat/my', {
      params: { scope: 'GENERAL' },
    })
  })

  it('запрашивает финансовый канал ADMIN', async () => {
    await chatApi.my('ADMIN')
    expect(get).toHaveBeenCalledWith('/v1/chat/my', {
      params: { scope: 'ADMIN' },
    })
  })

  it('разворачивает r.data', async () => {
    get.mockResolvedValue({ data: { conversation: { id: 'c1' }, messages: [] } })
    const r = await chatApi.my()
    expect(r.conversation.id).toBe('c1')
  })
})

describe('chatApi.parentSend', () => {
  it('шлёт текст с дефолтным scope GENERAL', async () => {
    await chatApi.parentSend('привет')
    expect(post).toHaveBeenCalledWith('/v1/chat/my/messages', {
      text: 'привет',
      scope: 'GENERAL',
    })
  })

  it('шлёт в канал ADMIN когда указано', async () => {
    await chatApi.parentSend('вопрос по оплате', 'ADMIN')
    expect(post).toHaveBeenCalledWith('/v1/chat/my/messages', {
      text: 'вопрос по оплате',
      scope: 'ADMIN',
    })
  })
})

describe('chatApi.paymentReminder (админ)', () => {
  it('шлёт studentId/month/amount на payment-reminder', async () => {
    post.mockResolvedValue({ data: { sent: 2 } })
    const r = await chatApi.paymentReminder('s1', '2026-05', 1200)
    expect(post).toHaveBeenCalledWith('/v1/chat/payment-reminder', {
      studentId: 's1',
      month: '2026-05',
      amount: 1200,
    })
    expect(r.sent).toBe(2)
  })
})

describe('chatApi сотрудника', () => {
  it('conversations() бьёт в список переписок', async () => {
    get.mockResolvedValue({ data: [] })
    await chatApi.conversations()
    expect(get).toHaveBeenCalledWith('/v1/chat/conversations')
  })

  it('staffSend не передаёт scope (учитель пишет в открытую переписку)', async () => {
    await chatApi.staffSend('c1', 'ответ')
    expect(post).toHaveBeenCalledWith('/v1/chat/conversations/c1/messages', {
      text: 'ответ',
    })
  })
})
