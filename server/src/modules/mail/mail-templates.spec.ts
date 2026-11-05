import { BRAND, escapeHtml, hoursLabel, inviteEmail, resetEmail } from './mail-templates'

const LINK = 'https://tahlilgar.cyou/set-password?token=abc_DEF-123'

describe('hoursLabel', () => {
  it('склоняет «час»', () => {
    expect(hoursLabel(1)).toBe('1 час')
    expect(hoursLabel(2)).toBe('2 часа')
    expect(hoursLabel(5)).toBe('5 часов')
    expect(hoursLabel(11)).toBe('11 часов')
    expect(hoursLabel(21)).toBe('21 час')
    expect(hoursLabel(22)).toBe('22 часа')
    expect(hoursLabel(48)).toBe('48 часов')
  })
})

describe('escapeHtml', () => {
  it('экранирует теги и кавычки', () => {
    expect(escapeHtml('<b>"A" & \'B\'</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;')
  })
})

describe('письма', () => {
  it('приглашение: тема, имя, срок, ссылка и в html, и в тексте', () => {
    const m = inviteEmail({ name: 'Шерамардов Кутбиддин', link: LINK, hours: 48 })

    expect(m.subject).toBe('Вас пригласили в «Мактаби ман»')
    for (const body of [m.html, m.text]) {
      expect(body).toContain('Шерамардов Кутбиддин')
      expect(body).toContain('48 часов')
      expect(body).toContain(LINK)
    }
    expect(m.html).toContain(BRAND)
    expect(m.html).toContain(`href="${LINK}"`)
    expect(m.html).toContain('Задать пароль')
  })

  it('сброс пароля: своя тема и срок 2 часа, при этом старый пароль не отменяется', () => {
    const m = resetEmail({ name: 'Мария', link: LINK, hours: 2 })

    expect(m.subject).toBe('Смена пароля в «Мактаби ман»')
    expect(m.text).toContain('2 часа')
    expect(m.text).toContain(LINK)
    expect(m.text).toContain('старый пароль продолжит работать')
  })

  it('имя из базы не может внедрить разметку в письмо', () => {
    const m = inviteEmail({ name: '<script>alert(1)</script>', link: LINK, hours: 48 })

    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;')
  })

  it('ссылка в html экранируется (амперсанды), в тексте остаётся как есть', () => {
    const link = 'https://tahlilgar.cyou/set-password?token=a&b=1'
    const m = resetEmail({ name: 'А', link, hours: 2 })

    expect(m.html).toContain('token=a&amp;b=1')
    expect(m.text).toContain(link)
  })
})
