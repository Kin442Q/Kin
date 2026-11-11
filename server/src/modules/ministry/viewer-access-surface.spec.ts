import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..', '..')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

/**
 * Охрана от тихого расширения доступа: наблюдателю открыты ровно три контроллера. Если кто-то
 * поставит @AllowViewer() на новую ручку (например, чтобы «заработало»), этот тест упадёт, и решение
 * придётся принять осознанно, дописав здесь список.
 */
describe('поверхность доступа наблюдателя (VIEWER)', () => {
  const marked = files(SRC)
    .filter((f) => f.endsWith('.controller.ts'))
    .filter((f) => /@AllowViewer\(/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(SRC, f).split('\\').join('/'))
    .sort()

  it('@AllowViewer стоит только на auth, regions и ministry', () => {
    expect(marked).toEqual(['modules/auth/auth.controller.ts', 'modules/ministry/ministry.controller.ts', 'modules/regions/regions.controller.ts'])
  })

  it('управление наблюдателями (создание, охват, отключение) наблюдателю недоступно', () => {
    const source = readFileSync(join(SRC, 'modules/ministry/ministry.controller.ts'), 'utf8')
    const viewersPart = source.slice(source.indexOf("path: 'ministry/viewers'"))
    expect(viewersPart).not.toContain('@AllowViewer')
    expect(viewersPart).toContain("@Roles('SUPER_ADMIN')")
  })

  it('глобальный запрет подключён после проверки токена', () => {
    const app = readFileSync(join(SRC, 'app.module.ts'), 'utf8')
    const jwt = app.indexOf('useClass: JwtAuthGuard')
    const deny = app.indexOf('useClass: ViewerDenyGuard')
    expect(jwt).toBeGreaterThan(-1)
    expect(deny).toBeGreaterThan(jwt)
  })
})
