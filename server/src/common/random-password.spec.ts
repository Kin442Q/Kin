import { randomPassword } from './random-password'

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
