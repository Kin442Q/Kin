import { http } from './http'

/* ============================================================
   Загрузка файлов (материалы к уроку, библиотека).
   Файлы лежат в хранилище сервера, в базе только запись; доступ к файлу —
   по короткой ссылке (5 минут), которую выдаёт сервер после проверки прав.
   ============================================================ */

export interface StoredFileView {
  id: string
  name: string
  size: number
  mime: string
}

/** Ссылка на скачивание: path вида /api/v1/files/dl/<токен>. */
export interface FileLink extends StoredFileView {
  path: string
}

export interface StorageUsage {
  usedBytes: number
  quotaBytes: number
  files: number
}

const MB = 1024 * 1024

type Kind = 'document' | 'image' | 'audio' | 'video'

/**
 * Зеркало server/src/modules/files/file-types.ts: разрешённые расширения и их
 * вид. Сервер всё равно проверяет сам (тип, подпись, размер, квоту) — здесь
 * только чтобы сразу сказать «не подойдёт», не гоня файл по сети.
 */
const KIND_BY_EXT: Record<string, Kind> = {
  pdf: 'document', doc: 'document', docx: 'document', ppt: 'document', pptx: 'document',
  xls: 'document', xlsx: 'document', odt: 'document', txt: 'document',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio',
  mp4: 'video', mov: 'video', webm: 'video',
}

export const MAX_FILE_MB: Record<Kind, number> = { document: 20, image: 20, audio: 20, video: 100 }

/** Значение для атрибута accept у <input type="file">. */
export const ACCEPT_ATTR = Object.keys(KIND_BY_EXT)
  .map((e) => `.${e}`)
  .join(',')

export const LIMITS_HINT = 'PDF, Word, презентации, картинки и аудио — до 20 МБ, видео — до 100 МБ. Длинное видео лучше дать ссылкой.'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < MB) return `${Math.round(bytes / 1024)} КБ`
  return `${Math.round((bytes / MB) * 10) / 10} МБ`
}

/** Текст ошибки, если файл заведомо не подойдёт; null — можно загружать. */
export function checkFile(file: { name: string; size: number }): string | null {
  const dot = file.name.lastIndexOf('.')
  const ext = dot < 0 ? '' : file.name.slice(dot + 1).toLowerCase()
  const kind = Object.prototype.hasOwnProperty.call(KIND_BY_EXT, ext) ? KIND_BY_EXT[ext] : undefined
  if (!kind) return 'Этот тип файла не поддерживается. Подойдут PDF, Word, презентации, картинки, аудио и видео'
  if (file.size <= 0) return 'Файл пустой'
  if (file.size > MAX_FILE_MB[kind] * MB) {
    return `Файл слишком большой: ${formatSize(file.size)}. Для этого типа максимум ${MAX_FILE_MB[kind]} МБ`
  }
  return null
}

/** Понятный текст ошибки загрузки (413 от multer приходит по-английски). */
export function uploadErrorText(e: any): string {
  const status = e?.response?.status
  const msg = e?.response?.data?.message
  const text = Array.isArray(msg) ? msg.join(', ') : msg
  if (status === 413) {
    return typeof text === 'string' && /[а-яё]/i.test(text)
      ? text
      : 'Файл слишком большой. Документы до 20 МБ, видео до 100 МБ'
  }
  if (status === 503) return 'Загрузка файлов пока не настроена. Используйте ссылку'
  return text || 'Не удалось загрузить файл'
}

/** Полный адрес по пути, который вернул сервер: учитывает API на другом домене (VITE_API_URL). */
export function fileUrl(path: string): string {
  const base = String(http.defaults.baseURL ?? '')
  if (/^https?:\/\//i.test(base)) return new URL(base).origin + path
  return path
}

/** Загрузить файл в поле «file» (multipart). Крупное видео — таймаут щедрый. */
export async function uploadFile(
  endpoint: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<StoredFileView> {
  const form = new FormData()
  form.append('file', file)
  const r = await http.post<StoredFileView>(endpoint, form, {
    timeout: 10 * 60 * 1000,
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    },
  })
  return r.data
}

/**
 * Открыть файл в новой вкладке. Вкладку открываем сразу по клику, а адрес
 * подставляем после ответа сервера: иначе браузер примет окно за всплывающее
 * и заблокирует.
 */
export async function openFileLink(getLink: () => Promise<FileLink>): Promise<void> {
  const win = window.open('about:blank', '_blank')
  try {
    const url = fileUrl((await getLink()).path)
    if (win) {
      win.location.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.click()
    }
  } catch (e) {
    win?.close()
    throw e
  }
}

export const filesApi = {
  /** Сколько места занято файлами школы и какой лимит. */
  usage: () => http.get<StorageUsage>('/v1/files/usage').then((r) => r.data),
}
