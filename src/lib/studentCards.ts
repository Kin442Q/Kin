import QRCode from 'qrcode'

/** QR-код ссылки как картинка (SVG в data-URL): рисуется у нас, во внешние сервисы ссылка не уходит. */
export async function qrDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export interface StudentCard {
  name: string
  /** data-URL картинки с QR-кодом; нет — на карточке только логин и пароль. */
  qr?: string
  /** Логин и пароль, выданные только что: печатаются на карточке. */
  login?: string
  password?: string
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export const CARD_CAPTION = 'Наведите камеру телефона на код'

/** HTML страницы с карточками учеников для печати: имя, QR и подпись, логин и пароль. */
export function studentCardsHtml(className: string, cards: StudentCard[], site?: string): string {
  const items = cards
    .map((c) => {
      const qr = c.qr
        ? `  <img src="${escapeHtml(c.qr)}" alt="QR-код для входа" />
  <div class="hint">${CARD_CAPTION}</div>`
        : ''
      const cred =
        c.login && c.password
          ? `  <div class="cred">
    ${site ? `<div class="site">Сайт: ${escapeHtml(site)}</div>` : ''}
    <div>Логин: <b>${escapeHtml(c.login)}</b></div>
    <div>Пароль: <b>${escapeHtml(c.password)}</b></div>
  </div>`
          : ''
      return `<div class="card">
  <div class="name">${escapeHtml(c.name)}</div>
${qr}
${cred}
</div>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Карточки входа — ${escapeHtml(className)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 12mm; color: #1b2a25; }
  h1 { font-size: 16px; margin: 0 0 10mm; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .card { border: 1px dashed #8aa39a; border-radius: 4mm; padding: 5mm 4mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .name { font-size: 15px; font-weight: 700; margin-bottom: 3mm; word-break: break-word; }
  .card img { width: 42mm; height: 42mm; display: block; margin: 0 auto 3mm; }
  .hint { font-size: 12px; color: #4b5d56; }
  .cred { margin-top: 3mm; padding-top: 3mm; border-top: 1px dashed #8aa39a; font-size: 14px; line-height: 1.7; }
  .cred b { font-family: ui-monospace, Consolas, monospace; font-size: 16px; letter-spacing: 0.04em; }
  .site { font-size: 12px; color: #4b5d56; }
  @media print { body { padding: 8mm; } }
</style>
</head>
<body>
<h1>Мактаби ман · ${escapeHtml(className)} · карточки для входа</h1>
<div class="grid">
${items}
</div>
</body>
</html>`
}

/**
 * Открывает окно с карточками и вызывает печать. Возвращает false, если браузер
 * не дал открыть окно (блокировщик всплывающих окон).
 */
export async function printStudentCards(
  className: string,
  rows: Array<{ name: string; link?: string | null; login?: string | null; password?: string | null }>,
): Promise<boolean> {
  const cards: StudentCard[] = []
  for (const r of rows) {
    cards.push({
      name: r.name,
      qr: r.link ? await qrDataUrl(r.link) : undefined,
      login: r.login ?? undefined,
      password: r.password ?? undefined,
    })
  }
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(studentCardsHtml(className, cards, window.location.origin))
  w.document.close()
  let printed = false
  const doPrint = () => {
    if (printed) return
    printed = true
    w.print()
  }
  w.addEventListener('load', doPrint)
  setTimeout(doPrint, 600)
  return true
}
