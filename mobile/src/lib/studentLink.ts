/**
 * Личная ссылка ученика вида `https://…/s/<токен>`, токен — `<id>.<подпись>`.
 * Из того, что вставил человек (целая ссылка, ссылка в тексте или один токен),
 * достаём токен. Мусор — null. Подпись проверяет сервер.
 */
const TOKEN = '[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{22}'
const BARE = new RegExp(`^${TOKEN}$`)
const IN_LINK = new RegExp(`/s/(${TOKEN})(?=$|[/?#\\s])`)

export function extractStudentToken(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  if (BARE.test(text)) return text
  const m = IN_LINK.exec(text)
  return m ? m[1] : null
}
