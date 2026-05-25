import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { http } from './http'
import { useAuthStore } from '../store/authStore'

/** Подменяем сетевой адаптер axios, чтобы тестировать интерсепторы без сети. */
function mockAdapterResolve(data: unknown, status = 200) {
  http.defaults.adapter = async (config): Promise<AxiosResponse> => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: config as never,
  })
}

function mockAdapterReject(status: number) {
  http.defaults.adapter = async (config) =>
    Promise.reject({
      config,
      response: { status, data: {}, statusText: '', headers: {}, config },
      isAxiosError: true,
      message: `Request failed with status code ${status}`,
    })
}

describe('http interceptors', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null })
  })

  it('разворачивает обёртку { data } от TransformInterceptor', async () => {
    mockAdapterResolve({ data: { hello: 'world' } })
    const r = await http.get('/x')
    expect(r.data).toEqual({ hello: 'world' })
  })

  it('не трогает ответ без обёртки', async () => {
    mockAdapterResolve({ hello: 'plain' })
    const r = await http.get('/x')
    expect(r.data).toEqual({ hello: 'plain' })
  })

  it('разворачивает { data, meta }', async () => {
    mockAdapterResolve({ data: [1, 2], meta: { total: 2 } })
    const r = await http.get('/x')
    expect(r.data).toEqual([1, 2])
  })

  it('добавляет Authorization, если есть токен', async () => {
    useAuthStore.setState({ token: 'jwt-123' })
    let seenAuth: unknown
    http.defaults.adapter = async (config): Promise<AxiosResponse> => {
      seenAuth = config.headers?.Authorization
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config as never,
      }
    }
    await http.get('/x')
    expect(seenAuth).toBe('Bearer jwt-123')
  })

  it('на 401 вызывает logout', async () => {
    const logoutSpy = vi.fn()
    useAuthStore.setState({ logout: logoutSpy })
    mockAdapterReject(401)
    await expect(http.get('/x')).rejects.toBeTruthy()
    expect(logoutSpy).toHaveBeenCalledTimes(1)
  })

  it('на 500 не вызывает logout', async () => {
    const logoutSpy = vi.fn()
    useAuthStore.setState({ logout: logoutSpy })
    mockAdapterReject(500)
    await expect(http.get('/x')).rejects.toBeTruthy()
    expect(logoutSpy).not.toHaveBeenCalled()
  })
})
