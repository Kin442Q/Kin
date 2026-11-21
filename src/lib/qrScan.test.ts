import { describe, it, expect } from 'vitest'
import QRCode from 'qrcode'

import { decodeQr, studentTokenFromQr } from './qrScan'

const TOKEN = 'cmabc123xyz.AbCdEfGhIjKlMnOpQrStUv'

describe('studentTokenFromQr: что считается QR-кодом ученика', () => {
  it('целая ссылка с карточки даёт токен', () => {
    expect(studentTokenFromQr(`https://tahlilgar.cyou/s/${TOKEN}`)).toBe(TOKEN)
  })

  it('хвостовой слэш, параметры и якорь не мешают; пробелы и перевод строки по краям тоже', () => {
    expect(studentTokenFromQr(`https://tahlilgar.cyou/s/${TOKEN}/`)).toBe(TOKEN)
    expect(studentTokenFromQr(`https://tahlilgar.cyou/s/${TOKEN}?utm=card`)).toBe(TOKEN)
    expect(studentTokenFromQr(`https://tahlilgar.cyou/s/${TOKEN}#x`)).toBe(TOKEN)
    expect(studentTokenFromQr(`  https://tahlilgar.cyou/s/${TOKEN}\n`)).toBe(TOKEN)
  })

  it('сам токен без адреса тоже подходит', () => {
    expect(studentTokenFromQr(TOKEN)).toBe(TOKEN)
  })

  it('чужие коды — текст, ссылка на другую страницу, Wi-Fi, пустое — не принимаются', () => {
    for (const text of ['', '   ', 'hello', 'https://tahlilgar.cyou/login', 'https://example.com/', 'WIFI:S:home;T:WPA;P:secret;;', 'tel:+992900000000']) {
      expect(studentTokenFromQr(text), text).toBeNull()
    }
  })

  it('подпись должна быть ровно из 22 символов: обрезанная или удлинённая ссылка не проходит', () => {
    expect(studentTokenFromQr('https://tahlilgar.cyou/s/cmabc123xyz.AbCdEfGhIjKlMnOpQrSt')).toBeNull()
    expect(studentTokenFromQr('https://tahlilgar.cyou/s/cmabc123xyz.AbCdEfGhIjKlMnOpQrStUvWx')).toBeNull()
  })

  it('чужой адрес с токеном даёт только токен: переходить будем на свой маршрут, а не по чужой ссылке', () => {
    // Подпись всё равно проверяет сервер; важно, что из чужого кода берётся лишь токен, а не адрес.
    const token = studentTokenFromQr(`https://evil.example/s/${TOKEN}`)
    expect(token).toBe(TOKEN)
    expect(token).not.toContain('evil')
  })
})

/** Нарисовать QR как кадр камеры: чёрные модули на белом, с тихой зоной, как на печатной карточке. */
function frameOf(text: string, module = 6, quiet = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const side = (size + quiet * 2) * module
  const data = new Uint8ClampedArray(side * side * 4).fill(255)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qr.modules.get(row, col)) continue
      for (let y = 0; y < module; y++) {
        for (let x = 0; x < module; x++) {
          const px = ((row + quiet) * module + y) * side + (col + quiet) * module + x
          data[px * 4] = data[px * 4 + 1] = data[px * 4 + 2] = 0
        }
      }
    }
  }
  return { data, width: side, height: side }
}

describe('decodeQr: чтение кода с кадра', () => {
  it('читает QR, который рисует наша карточка ученика (уровень коррекции M)', () => {
    const link = `https://tahlilgar.cyou/s/${TOKEN}`
    const { data, width, height } = frameOf(link)
    expect(decodeQr(data, width, height)).toBe(link)
  })

  it('прочитанное из карточки проходит весь путь до токена', () => {
    const { data, width, height } = frameOf(`https://tahlilgar.cyou/s/${TOKEN}`)
    expect(studentTokenFromQr(decodeQr(data, width, height) ?? '')).toBe(TOKEN)
  })

  it('в пустом кадре кода нет', () => {
    const blank = new Uint8ClampedArray(200 * 200 * 4).fill(255)
    expect(decodeQr(blank, 200, 200)).toBeNull()
  })

  it('чужой QR читается, но токена в нём нет', () => {
    const { data, width, height } = frameOf('https://example.com/promo')
    const text = decodeQr(data, width, height)
    expect(text).toBe('https://example.com/promo')
    expect(studentTokenFromQr(text!)).toBeNull()
  })
})
