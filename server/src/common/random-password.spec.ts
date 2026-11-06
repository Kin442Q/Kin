import { randomPassword, readablePassword } from './random-password'

describe('randomPassword', () => {
  it('нужной длины и без похожих символов (0, O, 1, l, I)', () => {
    for (let i = 0; i < 200; i++) {
      const p = randomPassword()
      expect(p).toHaveLength(14)
      expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/)
    }
    expect(randomPassword(20)).toHaveLength(20)
  })

  it('каждый раз разный', () => {
    const set = new Set(Array.from({ length: 200 }, () => randomPassword()))
    expect(set.size).toBe(200)
  })
})

describe('readablePassword', () => {
  it('8 знаков из строчных букв и цифр без похожих, каждый раз разный', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const p = readablePassword()
      expect(p).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/)
      seen.add(p)
    }
    expect(seen.size).toBe(300)
    expect(readablePassword(10)).toHaveLength(10)
  })
})
