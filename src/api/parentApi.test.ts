import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
vi.mock('./http', () => ({
  http: { get: (...a: unknown[]) => get(...a) },
}))

import { parentApi } from './parentApi'

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: [] })
})

describe('parentApi', () => {
  it('myKids → GET /v1/parent/me/kids', async () => {
    await parentApi.myKids()
    expect(get).toHaveBeenCalledWith('/v1/parent/me/kids')
  })

  it('today → GET /v1/parent/kids/:id/today', async () => {
    await parentApi.today('s1')
    expect(get).toHaveBeenCalledWith('/v1/parent/kids/s1/today')
  })

  it('schedule → GET /v1/parent/kids/:id/schedule', async () => {
    await parentApi.schedule('s1')
    expect(get).toHaveBeenCalledWith('/v1/parent/kids/s1/schedule')
  })

  it('payments → GET /v1/parent/kids/:id/payments', async () => {
    await parentApi.payments('s1')
    expect(get).toHaveBeenCalledWith('/v1/parent/kids/s1/payments')
  })

  it('grades → GET /v1/parent/kids/:id/grades', async () => {
    await parentApi.grades('s1')
    expect(get).toHaveBeenCalledWith('/v1/parent/kids/s1/grades')
  })

  it('разворачивает r.data', async () => {
    get.mockResolvedValue({ data: [{ id: 's1' }] })
    const kids = await parentApi.myKids()
    expect(kids).toEqual([{ id: 's1' }])
  })
})
