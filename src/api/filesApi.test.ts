import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.mock поднимается выше остального кода — общие моки создаём через vi.hoisted
const { post, get, httpMock } = vi.hoisted(() => {
  const post = vi.fn()
  const get = vi.fn()
  return { post, get, httpMock: { post, get, defaults: { baseURL: '/api' as string } } }
})
vi.mock('./http', () => ({ http: httpMock }))

import {
  ACCEPT_ATTR,
  checkFile,
  fileUrl,
  formatSize,
  openFileLink,
  uploadErrorText,
  uploadFile,
  type FileLink,
} from './filesApi'

const MB = 1024 * 1024
const link: FileLink = { id: 'f1', name: 'a.pdf', size: 10, mime: 'application/pdf', path: '/api/v1/files/dl/tok' }

beforeEach(() => {
  post.mockReset()
  get.mockReset()
  httpMock.defaults.baseURL = '/api'
})

describe('checkFile — проверка до отправки', () => {
  it('подходящие файлы проходят, в том числе по регистру расширения', () => {
    expect(checkFile({ name: 'Учебник.PDF', size: 5 * MB })).toBeNull()
    expect(checkFile({ name: 'урок.mp4', size: 99 * MB })).toBeNull()
    expect(checkFile({ name: 'фото.jpeg', size: 1 })).toBeNull()
  })

  it('программы, архивы, HTML и файлы без расширения отклоняются', () => {
    for (const name of ['virus.exe', 'a.zip', 'page.html', 'pic.svg', 'noext', 'toString']) {
      expect(checkFile({ name, size: 10 })).toMatch(/не поддерживается/)
    }
  })

  it('лимит по виду: документ 20 МБ, видео 100 МБ; пустой файл — нельзя', () => {
    expect(checkFile({ name: 'big.pdf', size: 21 * MB })).toMatch(/максимум 20 МБ/)
    expect(checkFile({ name: 'big.mp3', size: 21 * MB })).toMatch(/максимум 20 МБ/)
    expect(checkFile({ name: 'ok.mp4', size: 50 * MB })).toBeNull()
    expect(checkFile({ name: 'huge.mp4', size: 101 * MB })).toMatch(/максимум 100 МБ/)
    expect(checkFile({ name: 'empty.pdf', size: 0 })).toBe('Файл пустой')
  })

  it('accept для input содержит разрешённые расширения и не содержит опасных', () => {
    expect(ACCEPT_ATTR).toContain('.pdf')
    expect(ACCEPT_ATTR).toContain('.mp4')
    expect(ACCEPT_ATTR).not.toContain('.exe')
    expect(ACCEPT_ATTR).not.toContain('.html')
  })
})

describe('formatSize', () => {
  it('байты, килобайты, мегабайты', () => {
    expect(formatSize(512)).toBe('512 Б')
    expect(formatSize(2048)).toBe('2 КБ')
    expect(formatSize(5 * MB)).toBe('5 МБ')
    expect(formatSize(1.5 * MB)).toBe('1.5 МБ')
  })
})

describe('uploadErrorText', () => {
  it('413: русский текст сервера сохраняется, английский «File too large» заменяется', () => {
    expect(uploadErrorText({ response: { status: 413, data: { message: 'Не хватает места: занято 2 ГБ' } } })).toBe('Не хватает места: занято 2 ГБ')
    expect(uploadErrorText({ response: { status: 413, data: { message: 'File too large' } } })).toMatch(/до 20 МБ, видео до 100 МБ/)
  })

  it('503 — загрузка не настроена; 400 — текст сервера; прочее — запасной текст', () => {
    expect(uploadErrorText({ response: { status: 503, data: {} } })).toMatch(/не настроена/)
    expect(uploadErrorText({ response: { status: 400, data: { message: 'Содержимое файла не соответствует его типу' } } })).toBe('Содержимое файла не соответствует его типу')
    expect(uploadErrorText({ response: { status: 400, data: { message: ['a', 'b'] } } })).toBe('a, b')
    expect(uploadErrorText(new Error('network'))).toBe('Не удалось загрузить файл')
  })
})

describe('fileUrl', () => {
  it('API на том же домене (прокси /api) — путь как есть', () => {
    expect(fileUrl('/api/v1/files/dl/t')).toBe('/api/v1/files/dl/t')
  })

  it('API на другом домене (VITE_API_URL) — подставляется его адрес', () => {
    httpMock.defaults.baseURL = 'https://kin.up.railway.app/api'
    expect(fileUrl('/api/v1/files/dl/t')).toBe('https://kin.up.railway.app/api/v1/files/dl/t')
  })
})

describe('uploadFile', () => {
  it('шлёт multipart в поле «file», считает прогресс и ставит щедрый таймаут', async () => {
    post.mockImplementation(async (_url: string, _body: FormData, cfg: { onUploadProgress: (e: { loaded: number; total: number }) => void }) => {
      cfg.onUploadProgress({ loaded: 25, total: 100 })
      cfg.onUploadProgress({ loaded: 100, total: 100 })
      return { data: { id: 'f1', name: 'a.pdf', size: 3, mime: 'application/pdf' } }
    })
    const progress: number[] = []
    const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' })

    const res = await uploadFile('/v1/lesson-materials/upload', file, (p) => progress.push(p))

    expect(res.id).toBe('f1')
    expect(progress).toEqual([25, 100])
    const [url, body, cfg] = post.mock.calls[0]
    expect(url).toBe('/v1/lesson-materials/upload')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBeInstanceOf(File)
    expect(((body as FormData).get('file') as File).name).toBe('a.pdf')
    expect(cfg.timeout).toBeGreaterThanOrEqual(5 * 60 * 1000)
  })
})

describe('openFileLink', () => {
  let open: ReturnType<typeof vi.fn>
  beforeEach(() => {
    open = vi.fn()
    vi.stubGlobal('open', open)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('вкладку открывает сразу (до ответа сервера), потом подставляет адрес файла', async () => {
    const win = { location: { href: '' }, close: vi.fn() }
    open.mockReturnValue(win)
    let release!: (l: FileLink) => void
    const pending = openFileLink(() => new Promise<FileLink>((r) => (release = r)))

    expect(open).toHaveBeenCalledWith('about:blank', '_blank') // ещё до получения ссылки
    expect(win.location.href).toBe('')
    release(link)
    await pending
    expect(win.location.href).toBe('/api/v1/files/dl/tok')
    expect(win.close).not.toHaveBeenCalled()
  })

  it('сервер отказал — пустая вкладка закрывается, ошибка уходит наружу', async () => {
    const win = { location: { href: '' }, close: vi.fn() }
    open.mockReturnValue(win)
    await expect(openFileLink(() => Promise.reject(new Error('403')))).rejects.toThrow('403')
    expect(win.close).toHaveBeenCalled()
  })

  it('браузер заблокировал окно — открываем обычной ссылкой в новой вкладке', async () => {
    open.mockReturnValue(null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await openFileLink(async () => link)
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })
})
