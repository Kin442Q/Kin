import { randomInt } from 'node:crypto'

/** Без похожих символов (0/O, 1/l/I), чтобы пароль можно было продиктовать. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Случайный пароль из криптостойкого генератора. */
export function randomPassword(length = 14): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

/** Для учеников: только строчные буквы и цифры без похожих (i, l, o, 0, 1), удобно набирать на телефоне. */
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Короткий пароль для ученика, который выдаёт классный руководитель (8 знаков ≈ 40 бит). */
export function readablePassword(length = 8): string {
  let out = ''
  for (let i = 0; i < length; i++) out += READABLE[randomInt(READABLE.length)]
  return out
}
