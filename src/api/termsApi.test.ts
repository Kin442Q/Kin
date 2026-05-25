import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
const post = vi.fn()
const patch = vi.fn()
const del = vi.fn()
vi.mock('./http', () => ({
  http: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}))

import { termsApi } from './termsApi'

beforeEach(() => {
  ;[get, post, patch, del].forEach((m) => m.mockReset())
  get.mockResolvedValue({ data: [] })
  post.mockResolvedValue({ data: {} })
  patch.mockResolvedValue({ data: {} })
  del.mockResolvedValue({ data: {} })
})

describe('termsApi', () => {
  it('list → GET /v1/terms', async () => {
    await termsApi.list()
    expect(get).toHaveBeenCalledWith('/v1/terms')
  })

  it('current → GET /v1/terms/current', async () => {
    await termsApi.current()
    expect(get).toHaveBeenCalledWith('/v1/terms/current')
  })

  it('create → POST /v1/terms с телом', async () => {
    const dto = { name: '1 четверть', startDate: '2026-09-01', endDate: '2026-10-31' }
    await termsApi.create(dto)
    expect(post).toHaveBeenCalledWith('/v1/terms', dto)
  })

  it('update → PATCH /v1/terms/:id', async () => {
    await termsApi.update('t1', { name: 'new' })
    expect(patch).toHaveBeenCalledWith('/v1/terms/t1', { name: 'new' })
  })

  it('remove → DELETE /v1/terms/:id', async () => {
    await termsApi.remove('t1')
    expect(del).toHaveBeenCalledWith('/v1/terms/t1')
  })
})
