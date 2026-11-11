import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { AllowViewer } from '../decorators/allow-viewer.decorator'
import { Public } from '../decorators/public.decorator'
import { ViewerDenyGuard } from './viewer-deny.guard'

class Closed {
  list() {}
}

class Open {
  @AllowViewer()
  read() {}

  @Public()
  login() {}

  hidden() {}
}

@AllowViewer({ write: true })
class AuthLike {
  logout() {}
}

function ctx(cls: new () => object, handler: string, user: { role: string } | undefined, method = 'GET'): ExecutionContext {
  return {
    getHandler: () => (cls.prototype as Record<string, () => void>)[handler],
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user, method }) }),
  } as unknown as ExecutionContext
}

describe('ViewerDenyGuard: наблюдателю закрыто всё, кроме разрешённого', () => {
  const guard = new ViewerDenyGuard(new Reflector())

  it('остальные роли проходят без проверок: guard их не касается', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT']) {
      expect(guard.canActivate(ctx(Closed, 'list', { role }))).toBe(true)
      expect(guard.canActivate(ctx(Closed, 'list', { role }, 'DELETE'))).toBe(true)
    }
  })

  it('без @AllowViewer наблюдатель получает отказ, даже на чтение', () => {
    expect(() => guard.canActivate(ctx(Closed, 'list', { role: 'VIEWER' }))).toThrow(ForbiddenException)
    expect(() => guard.canActivate(ctx(Open, 'hidden', { role: 'VIEWER' }))).toThrow(ForbiddenException)
  })

  it('с @AllowViewer наблюдатель читает, но не меняет данные', () => {
    expect(guard.canActivate(ctx(Open, 'read', { role: 'VIEWER' }))).toBe(true)
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() => guard.canActivate(ctx(Open, 'read', { role: 'VIEWER' }, method))).toThrow('только просматривать')
    }
  })

  it('запись разрешена только там, где явно указано write (выход, смена пароля)', () => {
    expect(guard.canActivate(ctx(AuthLike, 'logout', { role: 'VIEWER' }, 'POST'))).toBe(true)
  })

  it('публичные ручки (вход, ссылка с паролем) не блокируются', () => {
    expect(guard.canActivate(ctx(Open, 'login', { role: 'VIEWER' }, 'POST'))).toBe(true)
    expect(guard.canActivate(ctx(Closed, 'list', undefined))).toBe(true)
  })
})
