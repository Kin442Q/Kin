import type { Request, Response } from 'express'

import { AuthController } from './auth.controller'
import { JwtRefreshStrategy, refreshTokenFrom } from './strategies/jwt-refresh.strategy'

const req = (patch: Record<string, unknown> = {}) => ({ headers: {}, cookies: {}, body: {}, ip: '1.2.3.4', ...patch }) as unknown as Request
const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response

const tokens = {
  user: { id: 'u1' },
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: new Date('2026-12-06T00:00:00Z'),
}

describe('refresh-токен: сайт — cookie, мобильное приложение — тело', () => {
  describe('refreshTokenFrom', () => {
    it('cookie главнее тела; без cookie берётся тело; мусор и пустое — null', () => {
      expect(refreshTokenFrom(req({ cookies: { refreshToken: 'from-cookie' }, body: { refreshToken: 'from-body' } }))).toBe('from-cookie')
      expect(refreshTokenFrom(req({ body: { refreshToken: 'from-body' } }))).toBe('from-body')
      expect(refreshTokenFrom(req())).toBeNull()
      expect(refreshTokenFrom(req({ body: { refreshToken: 123 } }))).toBeNull()
      expect(refreshTokenFrom(req({ body: { refreshToken: '' } }))).toBeNull()
      expect(refreshTokenFrom(undefined)).toBeNull()
    })
  })

  describe('JwtRefreshStrategy.validate', () => {
    const strategy = new JwtRefreshStrategy({ get: () => 'r-secret' } as never)

    it('токен из тела запроса принимается так же, как из cookie', async () => {
      const out = await strategy.validate(req({ body: { refreshToken: 'tok' } }), { sub: 'u1', jti: 'j1' } as never)
      expect(out).toEqual({ sub: 'u1', jti: 'j1', raw: 'tok' })
    })

    it('ни cookie, ни тела — 401', async () => {
      await expect(strategy.validate(req(), { sub: 'u1', jti: 'j1' } as never)).rejects.toThrow(/Refresh token missing/)
    })
  })

  describe('AuthController: что отдаётся в ответе', () => {
    const auth = {
      login: jest.fn().mockResolvedValue(tokens),
      refresh: jest.fn().mockResolvedValue(tokens),
      loginWithStudentLink: jest.fn().mockResolvedValue(tokens),
      logout: jest.fn().mockResolvedValue(undefined),
    }
    const controller = new AuthController(auth as never, {} as never)

    it('сайт: refresh-токена в теле нет, он только в cookie', async () => {
      const r = res()
      const body = await controller.login({ email: 'a@b.tj', password: 'x' } as never, req(), r)

      expect(body).toEqual({ user: { id: 'u1' }, accessToken: 'access-1' })
      expect(r.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-1', expect.objectContaining({ httpOnly: true }))
    })

    it('мобильное приложение (X-Client: mobile): refresh-токен и срок приходят в теле', async () => {
      const mobile = req({ headers: { 'x-client': 'mobile' } })
      const login = await controller.login({ email: 'a@b.tj', password: 'x' } as never, mobile, res())
      const link = await controller.studentLink({ token: 't' } as never, mobile, res())
      const refreshed = await controller.refresh(
        req({ headers: { 'x-client': 'mobile' }, user: { sub: 'u1', jti: 'j1', raw: 'refresh-1' } }),
        res(),
      )

      for (const body of [login, link, refreshed]) {
        expect(body).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1', refreshTokenExpiresAt: tokens.refreshTokenExpiresAt })
      }
    })

    it('выход: jti берётся из refresh-токена в теле запроса и отзывается', async () => {
      // «токен» с JSON-нагрузкой {jti: 'j-body'} посередине
      const payload = Buffer.from(JSON.stringify({ jti: 'j-body' })).toString('base64')
      await controller.logout(
        req({ body: { refreshToken: `h.${payload}.s` }, headers: {} }),
        res(),
        { sub: 'u1' } as never,
      )
      expect(auth.logout).toHaveBeenCalledWith('u1', 'j-body', undefined)
    })
  })
})
