import { describe, it, expect, vi, afterEach } from 'vitest'

import { CARD_CAPTION, escapeHtml, printStudentCards, qrDataUrl, studentCardsHtml } from './studentCards'

const LINK = 'https://tahlilgar.cyou/s/u1.AbCdEfGhIjKlMnOpQrStUv'

describe('qrDataUrl', () => {
  it('рисует QR локально: SVG в data-URL, в котором есть разметка кода', async () => {
    const url = await qrDataUrl(LINK)

    expect(url.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    const svg = decodeURIComponent(url.slice('data:image/svg+xml;utf8,'.length))
    expect(svg).toContain('<svg')
    expect(svg).toContain('<path')
  })

  it('разные ссылки — разные картинки', async () => {
    expect(await qrDataUrl(LINK)).not.toBe(await qrDataUrl(LINK + 'x'))
  })
})

describe('studentCardsHtml', () => {
  it('на каждого ученика карточка: имя, QR и подпись «Наведите камеру телефона на код»', () => {
    const html = studentCardsHtml('5А', [
      { name: 'Каримов Али', qr: 'data:image/svg+xml;utf8,AAA' },
      { name: 'Рахимова Мадина', qr: 'data:image/svg+xml;utf8,BBB' },
    ])

    expect(html.match(/class="card"/g)).toHaveLength(2)
    expect(html).toContain('Каримов Али')
    expect(html).toContain('Рахимова Мадина')
    expect(html).toContain('src="data:image/svg+xml;utf8,AAA"')
    expect(html.split(CARD_CAPTION)).toHaveLength(3)
    expect(CARD_CAPTION).toBe('Наведите камеру телефона на код')
    expect(html).toContain('Мактаби ман')
    expect(html).toContain('5А')
  })

  it('имена и класс экранируются: HTML из данных не исполняется', () => {
    const html = studentCardsHtml('<b>5А</b>', [{ name: '<img src=x onerror=alert(1)>', qr: 'data:x"onload="alert(2)' }])

    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>5А</b>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('"onload="')
  })

  it('ссылки в карточках нет: на листке только QR (сама ссылка секретна, как пароль)', () => {
    const html = studentCardsHtml('5А', [{ name: 'Каримов Али', qr: 'data:image/svg+xml;utf8,AAA' }])
    expect(html).not.toContain('tahlilgar.cyou/s/')
  })
})

describe('escapeHtml', () => {
  it('экранирует служебные символы', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;')
  })
})

describe('printStudentCards', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('открывает окно, пишет в него карточки и запускает печать', async () => {
    const write = vi.fn()
    const w = {
      document: { open: vi.fn(), write, close: vi.fn() },
      addEventListener: vi.fn((_: string, cb: () => void) => cb()), // «load» сразу
      print: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window)

    const ok = await printStudentCards('5А', [{ name: 'Каримов Али', link: LINK }])

    expect(ok).toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    const html = write.mock.calls[0][0] as string
    expect(html).toContain('Каримов Али')
    expect(html).toContain('<svg'.replace('<', '%3C')) // QR в виде закодированного SVG
    expect(w.print).toHaveBeenCalledTimes(1) // ровно один раз, хотя есть и «load», и таймер
  })

  it('окно заблокировано — возвращает false и ничего не падает', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(await printStudentCards('5А', [{ name: 'Каримов Али', link: LINK }])).toBe(false)
  })
})
