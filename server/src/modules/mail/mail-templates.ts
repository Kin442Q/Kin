/**
 * Тексты писем. Чистые функции: имя пользователя экранируется, ссылка
 * вставляется как есть (её формирует сервер). Название продукта пока
 * «Мактаби ман», логотип в письме — текстовая шапка.
 */
export const BRAND = 'Мактаби ман'

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** «48 часов», «2 часа», «1 час». */
export function hoursLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} час`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} часа`
  return `${n} часов`
}

interface LayoutInput {
  title: string
  greeting: string
  paragraphs: string[]
  buttonText: string
  link: string
  footnote: string
}

function layout(i: LayoutInput): string {
  const link = escapeHtml(i.link)
  const paragraphs = i.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#33443d;">${escapeHtml(p)}</p>`)
    .join('')
  return `<!doctype html>
<html lang="ru"><body style="margin:0;padding:0;background:#f2f6f4;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6f4;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0f7a55;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;">${BRAND}</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 14px;font-size:20px;color:#0f2a22;">${escapeHtml(i.title)}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#33443d;">${escapeHtml(i.greeting)}</p>
${paragraphs}
<p style="margin:22px 0;"><a href="${link}" style="display:inline-block;background:#12a06e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px;">${escapeHtml(i.buttonText)}</a></p>
<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6b7f76;">Если кнопка не нажимается, скопируйте ссылку в браузер:</p>
<p style="margin:0 0 18px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:#12a06e;">${link}</a></p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#6b7f76;">${escapeHtml(i.footnote)}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

function plain(greeting: string, lines: string[], link: string, footnote: string): string {
  return [greeting, '', ...lines, '', link, '', footnote].join('\n')
}

interface LinkMailInput {
  name: string
  link: string
  /** Сколько часов действует ссылка. */
  hours: number
}

/** Приглашение: человек сам задаёт пароль по ссылке. */
export function inviteEmail({ name, link, hours }: LinkMailInput): EmailContent {
  const greeting = `Здравствуйте, ${name}!`
  const lines = [
    `Для вас создан доступ к «${BRAND}».`,
    `Нажмите кнопку, придумайте пароль и войдите. Ссылка действует ${hoursLabel(hours)} и открывается один раз.`,
  ]
  const footnote = 'Если вы не ожидали это письмо, просто проигнорируйте его.'
  return {
    subject: `Вас пригласили в «${BRAND}»`,
    html: layout({
      title: 'Добро пожаловать',
      greeting,
      paragraphs: lines,
      buttonText: 'Задать пароль',
      link,
      footnote,
    }),
    text: plain(greeting, lines, link, footnote),
  }
}

/** Сброс пароля по запросу «Забыли пароль?». */
export function resetEmail({ name, link, hours }: LinkMailInput): EmailContent {
  const greeting = `Здравствуйте, ${name}!`
  const lines = [
    `Мы получили запрос на смену пароля в «${BRAND}».`,
    `Нажмите кнопку и придумайте новый пароль. Ссылка действует ${hoursLabel(hours)} и открывается один раз.`,
  ]
  const footnote = 'Если вы не просили сменить пароль, ничего не делайте: старый пароль продолжит работать.'
  return {
    subject: `Смена пароля в «${BRAND}»`,
    html: layout({
      title: 'Смена пароля',
      greeting,
      paragraphs: lines,
      buttonText: 'Придумать новый пароль',
      link,
      footnote,
    }),
    text: plain(greeting, lines, link, footnote),
  }
}
