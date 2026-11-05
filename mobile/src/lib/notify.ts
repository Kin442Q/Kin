import { create } from 'zustand'

import { describeError } from './errorText'

export type NoticeKind = 'error' | 'offline' | 'success' | 'info'

export interface Notice {
  id: number
  kind: NoticeKind
  title: string
  message?: string
  /** Кнопка в плашке, например «Повторить» */
  actionLabel?: string
  onAction?: () => void
}

interface NoticeState {
  notice: Notice | null
  show: (n: Omit<Notice, 'id'>) => void
  hide: () => void
}

let seq = 0
let lastKey = ''
let lastAt = 0

/**
 * Одна плашка за раз. Одинаковая плашка в течение нескольких секунд не повторяется:
 * когда пропал интернет, падают сразу несколько запросов, а человеку достаточно одного сообщения.
 */
export const useNoticeStore = create<NoticeState>((set) => ({
  notice: null,
  show: (n) => {
    const key = `${n.kind}|${n.title}|${n.message ?? ''}`
    const now = Date.now()
    if (key === lastKey && now - lastAt < 4000) return
    lastKey = key
    lastAt = now
    set({ notice: { ...n, id: ++seq } })
  },
  hide: () => set({ notice: null }),
}))

interface ErrorOptions {
  /** Текст на случай, когда сервер ничего внятного не ответил */
  fallback?: string
  /** Свой заголовок вместо стандартного */
  title?: string
  /** Если задано — в плашке появится кнопка «Повторить» */
  retry?: () => void
}

/** Показать ошибку запроса красивой плашкой вместо системного окна. */
export function notifyError(error: unknown, options: ErrorOptions | string = {}) {
  const o: ErrorOptions = typeof options === 'string' ? { fallback: options } : options
  const info = describeError(error, o.fallback)
  useNoticeStore.getState().show({
    kind: info.kind,
    title: o.title && info.kind === 'error' ? o.title : info.title,
    message: info.message,
    actionLabel: o.retry ? 'Повторить' : undefined,
    onAction: o.retry,
  })
}

export const notify = {
  success: (title: string, message?: string) => useNoticeStore.getState().show({ kind: 'success', title, message }),
  info: (title: string, message?: string) => useNoticeStore.getState().show({ kind: 'info', title, message }),
  error: notifyError,
}
