/**
 * Какие файлы принимаем и как их проверяем. Чистая логика без Nest и Prisma —
 * чтобы её можно было тестировать отдельно.
 *
 * Тип определяем по расширению и подписи (первым байтам) файла; MIME, который
 * присылает клиент, не доверяем: подставить можно что угодно.
 */

export const MB = 1024 * 1024

export type FileKind = 'document' | 'image' | 'audio' | 'video'

/** Лимит размера одного файла по виду. Длинное видео лучше выкладывать ссылкой. */
export const MAX_FILE_BYTES: Record<FileKind, number> = {
  document: 20 * MB,
  image: 20 * MB,
  audio: 20 * MB,
  video: 100 * MB,
}

/** Наибольший из лимитов — потолок для multer, дальше проверяем по виду. */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(MAX_FILE_BYTES))

interface TypeDef {
  kind: FileKind
  mime: string
  /** Можно ли показывать в браузере (иначе — только скачивание). */
  inline: boolean
}

/** Разрешённые расширения. Программ, архивов, HTML и SVG здесь нет намеренно. */
const TYPES: Record<string, TypeDef> = {
  pdf: { kind: 'document', mime: 'application/pdf', inline: true },
  doc: { kind: 'document', mime: 'application/msword', inline: false },
  docx: { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', inline: false },
  ppt: { kind: 'document', mime: 'application/vnd.ms-powerpoint', inline: false },
  pptx: { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', inline: false },
  xls: { kind: 'document', mime: 'application/vnd.ms-excel', inline: false },
  xlsx: { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', inline: false },
  odt: { kind: 'document', mime: 'application/vnd.oasis.opendocument.text', inline: false },
  txt: { kind: 'document', mime: 'text/plain; charset=utf-8', inline: false },
  jpg: { kind: 'image', mime: 'image/jpeg', inline: true },
  jpeg: { kind: 'image', mime: 'image/jpeg', inline: true },
  png: { kind: 'image', mime: 'image/png', inline: true },
  webp: { kind: 'image', mime: 'image/webp', inline: true },
  gif: { kind: 'image', mime: 'image/gif', inline: true },
  mp3: { kind: 'audio', mime: 'audio/mpeg', inline: true },
  m4a: { kind: 'audio', mime: 'audio/mp4', inline: true },
  wav: { kind: 'audio', mime: 'audio/wav', inline: true },
  ogg: { kind: 'audio', mime: 'audio/ogg', inline: true },
  mp4: { kind: 'video', mime: 'video/mp4', inline: true },
  mov: { kind: 'video', mime: 'video/quicktime', inline: true },
  webm: { kind: 'video', mime: 'video/webm', inline: true },
}

export const ALLOWED_EXTENSIONS = Object.keys(TYPES)

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i < 0 ? '' : filename.slice(i + 1).toLowerCase()
}

export interface FileInfo {
  ext: string
  kind: FileKind
  mime: string
  inline: boolean
  maxBytes: number
}

/** null — расширение не разрешено. */
export function describeFile(filename: string): FileInfo | null {
  const ext = extensionOf(filename)
  const def = Object.prototype.hasOwnProperty.call(TYPES, ext) ? TYPES[ext] : undefined
  if (!def) return null
  return { ext, kind: def.kind, mime: def.mime, inline: def.inline, maxBytes: MAX_FILE_BYTES[def.kind] }
}

const startsWith = (head: Buffer, bytes: number[], offset = 0) =>
  head.length >= offset + bytes.length && bytes.every((b, i) => head[offset + i] === b)

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))

const ZIP = [0x50, 0x4b, 0x03, 0x04]
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

/**
 * Подпись файла соответствует расширению: переименованный .exe под видом .pdf
 * не пройдёт. `head` — первые байты файла (достаточно 16).
 */
export function matchesSignature(ext: string, head: Buffer): boolean {
  switch (ext) {
    case 'pdf':
      return startsWith(head, ascii('%PDF'))
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'odt':
      return startsWith(head, ZIP)
    case 'doc':
    case 'ppt':
    case 'xls':
      return startsWith(head, OLE)
    case 'txt':
      return !head.includes(0) // текст не содержит нулевых байтов
    case 'jpg':
    case 'jpeg':
      return startsWith(head, [0xff, 0xd8, 0xff])
    case 'png':
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'gif':
      return startsWith(head, ascii('GIF8'))
    case 'webp':
      return startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)
    case 'wav':
      return startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WAVE'), 8)
    case 'ogg':
      return startsWith(head, ascii('OggS'))
    case 'mp3':
      return startsWith(head, ascii('ID3')) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
    case 'm4a':
    case 'mp4':
    case 'mov':
      // контейнер ISO/QuickTime: на смещении 4 стоит имя первого «атома»
      return ['ftyp', 'moov', 'mdat', 'wide', 'free'].some((atom) => startsWith(head, ascii(atom), 4))
    case 'webm':
      return startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])
    default:
      return false
  }
}

/** Имя файла для заголовка Content-Disposition: без путей и управляющих символов. */
export function safeDownloadName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\\/\u0000-\u001f"]/g, '_').trim()
  return cleaned.slice(0, 200) || 'file'
}

export const formatMb = (bytes: number) => `${Math.round((bytes / MB) * 10) / 10} МБ`
