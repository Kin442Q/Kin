import type { AlertEvent, DescribedError } from './alert-event'

export interface AlertMailContext {
  /** Сколько раз та же ошибка повторилась с прошлого письма (письма по ней не отправлялись). */
  repeats: number
  /** Сколько других оповещений пропущено из-за лимита писем в час. */
  skipped: number
  commit: string | null
  at: Date
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function where(event: AlertEvent): string {
  if (event.source === 'process') return 'вне запроса (фоновая задача или сам процесс сервера)'
  return `${event.method ?? '?'} ${event.route ?? '?'}${event.status ? ` → HTTP ${event.status}` : ''}`
}

export function buildAlertMail(event: AlertEvent, err: DescribedError, ctx: AlertMailContext) {
  const title = `${err.name}${err.code ? ` (${err.code})` : ''}: ${err.message}`
  const when = ctx.at.toLocaleString('ru-RU', { timeZone: 'Asia/Dushanbe' })

  const lines = [
    'На сервере «Мактаби ман» произошла ошибка.',
    '',
    `Когда: ${when} (Душанбе)`,
    `Где: ${where(event)}`,
    `Ошибка: ${title}`,
    event.userId ? `Пользователь: ${event.userId}${event.role ? `, роль ${event.role}` : ''}` : null,
    `Версия: ${ctx.commit ?? 'неизвестна'}`,
    ctx.repeats > 0 ? `Повторилась ещё ${ctx.repeats} раз с прошлого письма об этой ошибке.` : null,
    ctx.skipped > 0 ? `Из-за лимита писем пропущено других оповещений: ${ctx.skipped}. Смотрите логи Railway.` : null,
    err.stack.length ? '' : null,
    err.stack.length ? 'Стек (начало):' : null,
    ...err.stack,
    '',
    'Полные логи: Railway → сервис с API → Deployments → View logs.',
    'Тело запроса, заголовки и пароли в письмо не попадают.',
  ].filter((l): l is string => l !== null)

  const text = lines.join('\n')
  const kind = event.label ?? (event.source === 'http' && event.status ? `Ошибка ${event.status}` : 'Ошибка')
  const subject = `[Мактаби ман] ${kind}: ${
    event.source === 'http' ? `${event.method ?? ''} ${event.route ?? ''}`.trim() : err.name
  }`.slice(0, 150)

  return {
    subject,
    text,
    html: `<pre style="font-family:Consolas,Menlo,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
  }
}
