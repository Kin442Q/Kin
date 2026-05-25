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

import {
  authService,
  groupsService,
  studentsService,
} from './services'

beforeEach(() => {
  ;[get, post, patch, del].forEach((m) => m.mockReset())
  get.mockResolvedValue({ data: {} })
  post.mockResolvedValue({ data: {} })
  patch.mockResolvedValue({ data: {} })
  del.mockResolvedValue({ data: {} })
})

describe('authService', () => {
  it('login → POST /v1/auth/login с email+password', async () => {
    await authService.login('a@kg.tj', 'pw')
    expect(post).toHaveBeenCalledWith('/v1/auth/login', {
      email: 'a@kg.tj',
      password: 'pw',
    })
  })
  it('me → GET /v1/auth/me', async () => {
    await authService.me()
    expect(get).toHaveBeenCalledWith('/v1/auth/me')
  })
})

describe('groupsService', () => {
  it('list → GET /v1/groups', async () => {
    await groupsService.list()
    expect(get).toHaveBeenCalledWith('/v1/groups')
  })
  it('update → PATCH /v1/groups/:id', async () => {
    await groupsService.update('g1', { name: 'A' })
    expect(patch).toHaveBeenCalledWith('/v1/groups/g1', { name: 'A' })
  })
  it('remove → DELETE /v1/groups/:id', async () => {
    await groupsService.remove('g1')
    expect(del).toHaveBeenCalledWith('/v1/groups/g1')
  })
})

describe('studentsService', () => {
  it('list без groupId → пустые params', async () => {
    await studentsService.list()
    expect(get).toHaveBeenCalledWith('/v1/students', { params: {} })
  })
  it('list с groupId → params.groupId', async () => {
    await studentsService.list('g1')
    expect(get).toHaveBeenCalledWith('/v1/students', { params: { groupId: 'g1' } })
  })
})
