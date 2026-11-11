import { Alert, Linking } from 'react-native'

import { SERVER_URL } from '../lib/config'
import { http } from './http'

/* ============================================================
   Загрузка и открытие файлов (материалы к уроку, библиотека).
   Зеркало web/src/api/filesApi.ts. Файл лежит в хранилище сервера,
   доступ — по короткой ссылке (5 минут) после проверки прав.
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

/** Файл, выбранный в системном окне (expo-document-picker). */
export interface PickedFile {
  uri: string
  name: string
  size?: number
  mimeType?: string
}

const MB = 1024 * 1024

type Kind = 'document' | 'image' | 'audio' | 'video'

/**
 * Зеркало server/src/modules/files/file-types.ts. Сервер проверяет сам
 * (тип, подпись, размер, квоту); здесь — чтобы сразу сказать «не подойдёт».
 */
const KIND_BY_EXT: Record<string, Kind> = {
  pdf: 'document', doc: 'document', docx: 'document', ppt: 'document', pptx: 'document',
  xls: 'document', xlsx: 'document', odt: 'document', txt: 'document',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio',
  mp4: 'video', mov: 'video', webm: 'video',
}

export const MAX_FILE_MB: Record<Kind, number> = { document: 20, image: 20, audio: 20, video: 100 }

export const LIMITS_HINT =
  'PDF, Word, презентации, картинки и аудио — до 20 МБ, видео — до 100 МБ. Длинное видео лучше дать ссылкой.'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < MB) return `${Math.round(bytes / 1024)} КБ`
  return `${Math.round((bytes / MB) * 10) / 10} МБ`
}

/**
 * Текст ошибки, если файл заведомо не подойдёт; null — можно загружать.
 * Размер телефон не всегда сообщает — тогда его проверит сервер.
 */
export function checkFile(file: { name: string; size?: number }): string | null {
  const dot = file.name.lastIndexOf('.')
  const ext = dot < 0 ? '' : file.name.slice(dot + 1).toLowerCase()
  const kind = Object.prototype.hasOwnProperty.call(KIND_BY_EXT, ext) ? KIND_BY_EXT[ext] : undefined
  if (!kind) return 'Этот тип файла не поддерживается. Подойдут PDF, Word, презентации, картинки, аудио и видео'
  if (file.size === undefined) return null
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

/** Полный адрес по пути, который вернул сервер. */
export function fileUrl(path: string): string {
  return SERVER_URL + path
}

/** Загрузить выбранный файл (multipart, поле «file»). Крупное видео — таймаут щедрый. */
export async function uploadFile(
  endpoint: string,
  file: PickedFile,
  onProgress?: (percent: number) => void,
): Promise<StoredFileView> {
  const form = new FormData()
  // В React Native файл в FormData описывается объектом {uri, name, type}.
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as never)
  const r = await http.post<StoredFileView>(endpoint, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 10 * 60 * 1000,
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    },
  })
  return r.data
}

/** Открыть внешнюю ссылку. Только http(s): ссылку вводит учитель, но схему всё равно проверяем. */
export async function openExternalUrl(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) {
    Alert.alert('Ссылка не открывается', 'Адрес должен начинаться с http:// или https://')
    return
  }
  try {
    await Linking.openURL(url)
  } catch {
    Alert.alert('Не удалось открыть', url)
  }
}

/** Запросить у сервера ссылку на файл и открыть её (скачивание / просмотр в браузере телефона). */
export async function openFileLink(getLink: () => Promise<FileLink>): Promise<void> {
  try {
    const link = await getLink()
    await Linking.openURL(fileUrl(link.path))
  } catch (e: any) {
    Alert.alert('Не удалось открыть файл', e?.response?.data?.message || 'Проверьте интернет и попробуйте ещё раз')
  }
}
