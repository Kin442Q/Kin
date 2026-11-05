import { randomInt } from 'node:crypto'

/** Без похожих символов (0/O, 1/l/I), чтобы пароль можно было продиктовать. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Случайный пароль из криптостойкого генератора. */
export function randomPassword(length = 14): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
