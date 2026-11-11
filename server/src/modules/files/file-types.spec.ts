import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MB, describeFile, extensionOf, matchesSignature, safeDownloadName } from './file-types'

const bytes = (...b: number[]) => Buffer.from(b)
const ascii = (s: string) => Buffer.from(s, 'latin1')
const pad = (b: Buffer, n = 16) => Buffer.concat([b, Buffer.alloc(Math.max(0, n - b.length))])

describe('describeFile', () => {
  it('известные расширения: вид, MIME и лимит по виду', () => {
    expect(describeFile('Учебник.PDF')).toMatchObject({ ext: 'pdf', kind: 'document', mime: 'application/pdf', inline: true, maxBytes: 20 * MB })
    expect(describeFile('урок.mp4')).toMatchObject({ kind: 'video', maxBytes: 100 * MB })
    expect(describeFile('записка.docx')).toMatchObject({ kind: 'document', inline: false })
    expect(describeFile('фото.JPEG')).toMatchObject({ kind: 'image', mime: 'image/jpeg' })
    expect(describeFile('песня.mp3')).toMatchObject({ kind: 'audio' })
  })

  it('программы, архивы, HTML и SVG не принимаем', () => {
    for (const bad of ['virus.exe', 'run.bat', 'page.html', 'pic.svg', 'a.zip', 'x.js', 'script.php', 'noext', '.pdf.exe', 'a.pdf ']) {
      expect(describeFile(bad)).toBeNull()
    }
    for (const dangerous of ['exe', 'html', 'svg', 'zip', 'js', 'bat', 'php', 'apk']) {
      expect(ALLOWED_EXTENSIONS).not.toContain(dangerous)
    }
  })

  it('расширение берётся после последней точки, регистр не важен', () => {
    expect(extensionOf('a.b.c.PDF')).toBe('pdf')
    expect(extensionOf('noext')).toBe('')
    expect(describeFile('toString')).toBeNull() // имя свойства Object.prototype не должно проходить
  })

  it('видео разрешено крупнее остальных', () => {
    expect(MAX_FILE_BYTES.video).toBeGreaterThan(MAX_FILE_BYTES.document)
  })
})

describe('matchesSignature', () => {
  it('настоящие заголовки проходят', () => {
    expect(matchesSignature('pdf', pad(ascii('%PDF-1.7')))).toBe(true)
    expect(matchesSignature('docx', pad(bytes(0x50, 0x4b, 0x03, 0x04)))).toBe(true)
    expect(matchesSignature('doc', pad(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)))).toBe(true)
    expect(matchesSignature('jpg', pad(bytes(0xff, 0xd8, 0xff, 0xe0)))).toBe(true)
    expect(matchesSignature('png', pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))).toBe(true)
    expect(matchesSignature('gif', pad(ascii('GIF89a')))).toBe(true)
    expect(matchesSignature('webp', Buffer.concat([ascii('RIFF'), bytes(0, 0, 0, 0), ascii('WEBP')]))).toBe(true)
    expect(matchesSignature('wav', Buffer.concat([ascii('RIFF'), bytes(0, 0, 0, 0), ascii('WAVE')]))).toBe(true)
    expect(matchesSignature('mp3', pad(ascii('ID3')))).toBe(true)
    expect(matchesSignature('mp3', pad(bytes(0xff, 0xfb, 0x90)))).toBe(true)
    expect(matchesSignature('mp4', Buffer.concat([bytes(0, 0, 0, 0x18), ascii('ftypmp42')]))).toBe(true)
    expect(matchesSignature('mov', Buffer.concat([bytes(0, 0, 0, 0x14), ascii('ftypqt  ')]))).toBe(true)
    expect(matchesSignature('webm', pad(bytes(0x1a, 0x45, 0xdf, 0xa3)))).toBe(true)
    expect(matchesSignature('ogg', pad(ascii('OggS')))).toBe(true)
    // текст в UTF-8; нулями не добиваем — настоящий файл читается без добивки
    expect(matchesSignature('txt', Buffer.from('Привет, урок', 'utf8'))).toBe(true)
  })

  it('программа, переименованная в pdf/docx/jpg/mp4, не проходит', () => {
    const exe = pad(ascii('MZ\x90\x00\x03'))
    for (const ext of ['pdf', 'docx', 'doc', 'jpg', 'png', 'gif', 'mp3', 'mp4', 'webm', 'ogg', 'wav', 'webp']) {
      expect(matchesSignature(ext, exe)).toBe(false)
    }
  })

  it('pdf в виде html, пустой файл и бинарник под видом txt отвергаются', () => {
    expect(matchesSignature('pdf', pad(ascii('<html><script>')))).toBe(false)
    expect(matchesSignature('pdf', Buffer.alloc(0))).toBe(false)
    expect(matchesSignature('txt', pad(bytes(0x41, 0x00, 0x42)))).toBe(false)
  })

  it('неизвестное расширение — никогда', () => {
    expect(matchesSignature('exe', pad(ascii('MZ')))).toBe(false)
  })
})

describe('safeDownloadName', () => {
  it('убирает путь, кавычки и управляющие символы', () => {
    expect(safeDownloadName('../../etc/passwd')).toBe('.._.._etc_passwd')
    expect(safeDownloadName('a"b\r\nc.pdf')).toBe('a_b__c.pdf')
    expect(safeDownloadName('   ')).toBe('file')
    expect(safeDownloadName('Урок №5.pdf')).toBe('Урок №5.pdf')
    expect(safeDownloadName('x'.repeat(500)).length).toBe(200)
  })
})
