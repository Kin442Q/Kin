import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LocalStorageDriver } from './local-storage.driver'

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(Buffer.from(c))
  return Buffer.concat(chunks).toString('utf8')
}

describe('LocalStorageDriver', () => {
  let root: string
  let src: string
  let driver: LocalStorageDriver

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'kin-store-'))
    src = join(await mkdtemp(join(tmpdir(), 'kin-src-')), 'in.bin')
    await writeFile(src, 'привет, файл')
    driver = new LocalStorageDriver(root)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('кладёт файл под ключом и читает его обратно', async () => {
    await driver.putFromPath('schools/k1/f1', src, { mime: 'text/plain', size: 1 })
    expect(await readAll(await driver.open('schools/k1/f1'))).toBe('привет, файл')
    // исходник остаётся: удаляет временный файл вызывающий
    expect((await stat(src)).isFile()).toBe(true)
  })

  it('удаление идемпотентно: второй раз и для несуществующего — не ошибка', async () => {
    await driver.putFromPath('schools/k1/f1', src, { mime: 'text/plain', size: 1 })
    await driver.delete('schools/k1/f1')
    await driver.delete('schools/k1/f1')
    await driver.delete('schools/k1/never-existed')
    await expect(readAll(await driver.open('schools/k1/f1'))).rejects.toThrow()
  })

  it('deletePrefix убирает все файлы школы и не трогает соседнюю', async () => {
    await driver.putFromPath('schools/k1/a', src, { mime: 'x', size: 1 })
    await driver.putFromPath('schools/k1/b', src, { mime: 'x', size: 1 })
    await driver.putFromPath('schools/k2/a', src, { mime: 'x', size: 1 })
    await driver.deletePrefix('schools/k1')
    await expect(stat(join(root, 'schools/k1'))).rejects.toThrow()
    expect(await readFile(join(root, 'schools/k2/a'), 'utf8')).toBe('привет, файл')
    await driver.deletePrefix('schools/k404') // нет такой папки — не ошибка
  })

  it('ключи с выходом за корень отвергаются', async () => {
    for (const bad of ['../outside', 'schools/../../outside', '/etc/passwd', '..']) {
      await expect(driver.putFromPath(bad, src, { mime: 'x', size: 1 })).rejects.toThrow('Недопустимый ключ')
      await expect(driver.open(bad)).rejects.toThrow('Недопустимый ключ')
      await expect(driver.delete(bad)).rejects.toThrow('Недопустимый ключ')
    }
    await expect(driver.deletePrefix('..')).rejects.toThrow('Недопустимый ключ')
  })
})
